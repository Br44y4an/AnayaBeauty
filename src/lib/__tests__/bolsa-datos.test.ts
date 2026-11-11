import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, llamadas, type ConsultaFalsa, type RespuestaFalsa } from "./supabase-falso";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (funcion: unknown) => funcion }));
const estado = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock("@/lib/supabase/publico", () => ({ clientePublico: () => estado.cliente }));

import { obtenerDatosBolsa } from "@/lib/data/bolsa";
import { obtenerConfiguracionDePrecios } from "@/lib/data/configuracion";

const ID_LABIAL = "0b8f3f4e-2c1a-4d7e-9a6b-5c4d3e2f1a0b";
const ID_OCULTO = "00000000-0000-4000-8000-000000000002";

const RESPUESTAS: Record<string, RespuestaFalsa> = {
  "from:categories": {
    data: [
      { id: "c-labios", nombre: "Labios", slug: "labios", orden: 30, categoria_padre_id: null, etiqueta_variante: null },
      { id: "c-paletas", nombre: "Paletas", slug: "paletas", orden: 1, categoria_padre_id: null, etiqueta_variante: "Paleta" },
    ],
    error: null,
  },
  "from:discount_rules": { data: [{ monto_minimo: 50000, porcentaje: 5 }], error: null },
  "from:store_settings": { data: [{ clave: "umbral_por_mayor", valor: "150000" }], error: null },
  "rpc:productos_del_carrito": {
    data: [
      {
        id: ID_LABIAL, referencia: "GLS735", nombre: "Brillo labial", imagen_principal: "f.jpg",
        stock: 8, activo: true,
        escalones: [{ min_cantidad: 3, precio_unitario: 7500 }, { min_cantidad: 1, precio_unitario: 8000 }],
      },
      { id: ID_OCULTO, referencia: "OLD-1", nombre: "Retirado", imagen_principal: null, stock: 3, activo: false, escalones: [] },
    ],
    error: null,
  },
  "from:products": {
    data: [
      {
        id: ID_LABIAL, category_id: "c-paletas", etiqueta_variante: null,
        product_shades: [
          { id: "v2", nombre: "Tono 2", color_hex: "#aa0000", orden: 2, agotado: true },
          { id: "v1", nombre: "Tono 1", color_hex: "#cc0000", orden: 1, agotado: false },
        ],
      },
    ],
    error: null,
  },
};

let consultas: ConsultaFalsa[] = [];

function usar(cambios: Record<string, RespuestaFalsa> = {}) {
  const falso = clienteFalso((c) => cambios[c.origen] ?? RESPUESTAS[c.origen] ?? { data: [], error: null });
  estado.cliente = falso.cliente;
  consultas = falso.consultas;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  usar();
});

describe("obtenerDatosBolsa", () => {
  it("junta stock y precio frescos con las variantes y la etiqueta de cada producto", async () => {
    const datos = await obtenerDatosBolsa([ID_LABIAL]);

    expect(datos.reglas).toEqual([{ montoMinimo: 50000, porcentaje: 5 }]);
    expect(datos.umbralPorMayor).toBe(150000);
    expect(datos.productos[0]).toEqual({
      id: ID_LABIAL,
      referencia: "GLS735",
      nombre: "Brillo labial",
      imagenPrincipal: "f.jpg",
      stock: 8,
      activo: true,
      escalones: [
        { minCantidad: 1, precioUnitario: 8000 },
        { minCantidad: 3, precioUnitario: 7500 },
      ],
      etiquetaVariante: "Paleta",
      variantes: [
        { id: "v1", nombre: "Tono 1", colorHex: "#cc0000", orden: 1, agotado: false },
        { id: "v2", nombre: "Tono 2", colorHex: "#aa0000", orden: 2, agotado: true },
      ],
    });
  });

  it("conserva el producto oculto, sin variantes, para decir que ya no está", async () => {
    const datos = await obtenerDatosBolsa([ID_LABIAL, ID_OCULTO]);
    const oculto = datos.productos.find((p) => p.id === ID_OCULTO);

    expect(oculto).toMatchObject({ activo: false, variantes: [], etiquetaVariante: "Tono" });
  });

  it("pide cada producto una sola vez y descarta lo que no es un id", async () => {
    await obtenerDatosBolsa([ID_LABIAL, "basura", ID_LABIAL]);

    expect(consultas.find((c) => c.origen === "rpc:productos_del_carrito")?.llamadas[0][2]).toEqual({
      p_ids: [ID_LABIAL],
    });
    expect(llamadas(consultas.find((c) => c.origen === "from:products"), "in")).toEqual([
      ["id", [ID_LABIAL]],
    ]);
  });

  it("sin ids no consulta productos, pero trae reglas y umbral", async () => {
    const datos = await obtenerDatosBolsa([]);

    expect(datos.productos).toEqual([]);
    expect(datos.umbralPorMayor).toBe(150000);
    expect(consultas.some((c) => c.origen === "rpc:productos_del_carrito")).toBe(false);
  });

  it("si la base falla, lanza: una bolsa vacía haría creer que se perdió todo", async () => {
    usar({ "rpc:productos_del_carrito": { data: null, error: { message: "timeout" } } });

    await expect(obtenerDatosBolsa([ID_LABIAL])).rejects.toThrow("No se pudo cargar tu bolsa");
  });
});

describe("obtenerConfiguracionDePrecios", () => {
  it("trae las reglas activas de mayor a menor y el umbral", async () => {
    const precios = await obtenerConfiguracionDePrecios();
    const reglas = consultas.find((c) => c.origen === "from:discount_rules");

    expect(precios).toEqual({ reglas: [{ montoMinimo: 50000, porcentaje: 5 }], umbralPorMayor: 150000 });
    expect(llamadas(reglas, "eq")).toEqual([["activo", true]]);
    expect(llamadas(reglas, "order")).toEqual([["monto_minimo", { ascending: false }]]);
  });

  it("si la base falla, lanza", async () => {
    usar({ "from:discount_rules": { data: null, error: { message: "timeout" } } });
    await expect(obtenerConfiguracionDePrecios()).rejects.toThrow("reglas de descuento");
  });
});
