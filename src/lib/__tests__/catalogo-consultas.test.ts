import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, llamadas, type ConsultaFalsa, type RespuestaFalsa } from "./supabase-falso";

vi.mock("server-only", () => ({}));
// Sin servidor de Next no hay caché: la función se ejecuta tal cual.
vi.mock("next/cache", () => ({ unstable_cache: (funcion: unknown) => funcion }));
const estado = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock("@/lib/supabase/publico", () => ({ clientePublico: () => estado.cliente }));

import {
  obtenerDestacados,
  obtenerProductoPorReferencia,
  obtenerProductos,
  obtenerRelacionados,
  obtenerSugerencias,
} from "@/lib/data/catalogo";

const CATEGORIAS = [
  { id: "c-labios", nombre: "Labios", slug: "labios", orden: 30, categoria_padre_id: null, etiqueta_variante: null },
  { id: "c-gloss", nombre: "Lip gloss", slug: "lip-gloss", orden: 10, categoria_padre_id: "c-labios", etiqueta_variante: null },
  { id: "c-barra", nombre: "Labial en barra", slug: "labial-en-barra", orden: 11, categoria_padre_id: "c-labios", etiqueta_variante: null },
  { id: "c-espejos", nombre: "Espejos", slug: "espejos", orden: 22, categoria_padre_id: null, etiqueta_variante: null },
];

function fila(id: string, referencia: string, categoria: string | null, extra: object = {}) {
  return {
    id,
    referencia,
    nombre: `Producto ${referencia}`,
    descripcion: null,
    category_id: categoria,
    imagen_principal: null,
    galeria: [],
    stock: 10,
    activo: true,
    destacado: false,
    etiqueta_variante: null,
    num_tonos: 0,
    price_tiers: [{ min_cantidad: 1, precio_unitario: 8000 }],
    ...extra,
  };
}

let consultas: ConsultaFalsa[] = [];

/** Responde las categorías siempre y, a lo demás, lo que se le pase. */
function usar(resto: (c: ConsultaFalsa) => RespuestaFalsa) {
  const falso = clienteFalso((c) =>
    c.origen === "from:categories" ? { data: CATEGORIAS, error: null } : resto(c)
  );
  estado.cliente = falso.cliente;
  consultas = falso.consultas;
}

const de = (origen: string) => consultas.find((c) => c.origen === origen);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  usar(() => ({ data: [], error: null, count: 0 }));
});

describe("obtenerProductos", () => {
  it("sin filtros pide la primera página de los activos en el orden recomendado", async () => {
    usar(() => ({ data: [fila("p1", "GLS735", "c-gloss")], error: null, count: 30 }));

    const pagina = await obtenerProductos({});
    const consulta = de("from:products");

    expect(llamadas(consulta, "select")[0][1]).toEqual({ count: "exact" });
    expect(llamadas(consulta, "eq")).toEqual([["activo", true]]);
    expect(llamadas(consulta, "order")).toEqual([
      ["orden", { ascending: true }],
      ["created_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(llamadas(consulta, "range")).toEqual([[0, 23]]);
    expect(pagina).toMatchObject({ total: 30, pagina: 1, porPagina: 24 });
    expect(pagina.productos.map((p) => [p.referencia, p.categoriaSlug])).toEqual([["GLS735", "lip-gloss"]]);
  });

  it("filtrar por una madre incluye sus hijas", async () => {
    await obtenerProductos({ categoriaSlug: "labios" });

    expect(llamadas(de("from:products"), "in")).toEqual([
      ["category_id", ["c-labios", "c-gloss", "c-barra"]],
    ]);
  });

  it("una categoría que no existe da una lista vacía sin consultar productos", async () => {
    const pagina = await obtenerProductos({ categoriaSlug: "no-existe" });

    expect(pagina).toEqual({ productos: [], total: 0, pagina: 1, porPagina: 24 });
    expect(de("from:products")).toBeUndefined();
  });

  it("ordena por el precio que se muestra, con el id de desempate", async () => {
    await obtenerProductos({ orden: "precio-desc" });

    expect(llamadas(de("from:products"), "order")).toEqual([
      ["precio_base", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
  });

  it("pide la tanda de la página indicada, o todas hasta ella", async () => {
    await obtenerProductos({ pagina: 3 });
    expect(llamadas(de("from:products"), "range")).toEqual([[48, 71]]);

    usar(() => ({ data: [], error: null, count: 0 }));
    await obtenerProductos({ pagina: 3, hastaPagina: true });
    expect(llamadas(de("from:products"), "range")).toEqual([[0, 71]]);
  });

  it("no pasa de la página 10", async () => {
    const pagina = await obtenerProductos({ pagina: 99 });

    expect(pagina.pagina).toBe(10);
    expect(llamadas(de("from:products"), "range")).toEqual([[216, 239]]);
  });

  it("busca con buscar_productos y los grupos de la búsqueda", async () => {
    await obtenerProductos({ busqueda: "labiales rojos", categoriaSlug: "labios" });
    const consulta = de("rpc:buscar_productos");

    expect(consulta?.llamadas[0]).toEqual([
      "rpc",
      "buscar_productos",
      { p_grupos: ["labial|lipstick", "rojo"], p_categorias: ["c-labios", "c-gloss", "c-barra"] },
      { count: "exact" },
    ]);
    expect(de("from:products")).toBeUndefined();
  });

  it("una búsqueda sin palabras útiles no trae el catálogo entero", async () => {
    const pagina = await obtenerProductos({ busqueda: "a" });

    expect(pagina.total).toBe(0);
    expect(de("rpc:buscar_productos")).toBeUndefined();
  });

  it("una página que ya no existe se trata como el final de la lista", async () => {
    usar(() => ({ data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } }));

    const pagina = await obtenerProductos({ pagina: 4 });
    expect(pagina).toEqual({ productos: [], total: 72, pagina: 4, porPagina: 24 });
  });

  it("ante un error de la base lanza en vez de mostrar el catálogo vacío", async () => {
    usar(() => ({ data: null, error: { message: "se cayó" } }));

    await expect(obtenerProductos({})).rejects.toThrow("No se pudieron cargar los productos");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("obtenerSugerencias", () => {
  it("pone primero la referencia exacta, aunque se escriba sin guion", async () => {
    usar(() => ({
      data: [
        { referencia: "USK-6210", nombre: "Otro", imagen_principal: null, precio_base: 9000, num_tonos: 0, category_id: "c-espejos", etiqueta_variante: null },
        { referencia: "USK-621", nombre: "Lip gloss gummy", imagen_principal: "f.jpg", precio_base: 12000, num_tonos: 6, category_id: "c-gloss", etiqueta_variante: null },
      ],
      error: null,
      count: 2,
    }));

    const r = await obtenerSugerencias("usk621");

    expect(de("rpc:buscar_productos")?.llamadas[0][2]).toEqual({ p_grupos: ["usk621"] });
    expect(r.total).toBe(2);
    expect(r.productos[0]).toEqual({
      referencia: "USK-621",
      nombre: "Lip gloss gummy",
      imagenPrincipal: "f.jpg",
      precioBase: 12000,
      numVariantes: 6,
      etiquetaVariante: "Tono",
    });
    expect(r.productos[1].etiquetaVariante).toBe("Color");
  });

  it("devuelve como máximo 8", async () => {
    const filas = Array.from({ length: 12 }, (_, i) => ({
      referencia: `R-${i}`, nombre: `P${i}`, imagen_principal: null, precio_base: 1000, num_tonos: 0, category_id: null, etiqueta_variante: null,
    }));
    usar(() => ({ data: filas, error: null, count: 12 }));

    const r = await obtenerSugerencias("producto");
    expect(r.productos).toHaveLength(8);
    expect(r.total).toBe(12);
  });

  it("no consulta con menos de dos letras", async () => {
    expect(await obtenerSugerencias("u")).toEqual({ total: 0, productos: [] });
    expect(de("rpc:buscar_productos")).toBeUndefined();
  });
});

describe("obtenerRelacionados", () => {
  it("busca en el departamento, con stock, sin el actual, y pone primero su categoría", async () => {
    usar(() => ({
      data: [fila("p8", "BARRA-1", "c-barra"), fila("p9", "GLOSS-2", "c-gloss")],
      error: null,
    }));
    const actual = { id: "p1", categoriaId: "c-gloss" } as Parameters<typeof obtenerRelacionados>[0];

    const relacionados = await obtenerRelacionados(actual);
    const consulta = de("from:products");

    expect(llamadas(consulta, "in")).toEqual([["category_id", ["c-labios", "c-gloss", "c-barra"]]]);
    expect(llamadas(consulta, "gt")).toEqual([["stock", 0]]);
    expect(llamadas(consulta, "neq")).toEqual([["id", "p1"]]);
    expect(relacionados.map((p) => p.referencia)).toEqual(["GLOSS-2", "BARRA-1"]);
  });

  it("sin categoría no hay relacionados", async () => {
    const actual = { id: "p1", categoriaId: null } as Parameters<typeof obtenerRelacionados>[0];

    expect(await obtenerRelacionados(actual)).toEqual([]);
    expect(de("from:products")).toBeUndefined();
  });
});

describe("obtenerDestacados y la ficha", () => {
  it("los destacados son los marcados y con stock", async () => {
    await obtenerDestacados();
    const consulta = de("from:products");

    expect(llamadas(consulta, "eq")).toEqual([["activo", true], ["destacado", true]]);
    expect(llamadas(consulta, "gt")).toEqual([["stock", 0]]);
    expect(llamadas(consulta, "limit")).toEqual([[12]]);
  });

  it("la ficha busca la referencia exacta, activa y con sus variantes", async () => {
    usar(() => ({
      data: fila("p1", "AC80/150", "c-gloss", {
        product_shades: [{ id: "v1", nombre: "Tono 1", color_hex: "#cc0000", orden: 1, agotado: true }],
      }),
      error: null,
    }));

    const producto = await obtenerProductoPorReferencia("AC80/150");
    const consulta = de("from:products");

    expect(String(llamadas(consulta, "select")[0][0])).toContain("product_shades");
    expect(llamadas(consulta, "eq")).toEqual([["referencia", "AC80/150"], ["activo", true]]);
    expect(producto?.variantes).toEqual([
      { id: "v1", nombre: "Tono 1", colorHex: "#cc0000", orden: 1, agotado: true },
    ]);
  });

  it("una referencia vacía no consulta", async () => {
    expect(await obtenerProductoPorReferencia("")).toBeNull();
    expect(de("from:products")).toBeUndefined();
  });
});
