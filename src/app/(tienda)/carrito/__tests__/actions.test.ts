import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, llamadas, type ConsultaFalsa, type RespuestaFalsa } from "@/lib/__tests__/supabase-falso";
import { mensajeAmable } from "@/lib/carrito/mensajes";
import type { DatosBolsa } from "@/lib/types";

vi.mock("server-only", () => ({}));

const simulado = vi.hoisted(() => ({
  cliente: null as unknown,
  despues: [] as (() => unknown)[],
  revalidateTag: vi.fn(),
  obtenerDatosBolsa: vi.fn(),
  enviarCorreoPedido: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "190.1.2.3", origin: "https://tienda.test" }),
}));
vi.mock("next/server", () => ({ after: (tarea: () => unknown) => void simulado.despues.push(tarea) }));
vi.mock("next/cache", () => ({ revalidateTag: simulado.revalidateTag }));
vi.mock("@/lib/supabase/admin", () => ({ clienteAdmin: () => simulado.cliente }));
vi.mock("@/lib/data/bolsa", () => ({ obtenerDatosBolsa: simulado.obtenerDatosBolsa }));
vi.mock("@/lib/email/send-order", () => ({ enviarCorreoPedido: simulado.enviarCorreoPedido }));
vi.mock("@/lib/legal", () => ({ VERSION_POLITICA: "2026-11-10" }));

import { confirmarPedido } from "@/app/(tienda)/carrito/actions";

const ID_BRILLO = "9917eda7-a4b9-4aa8-8db7-a519f12041e6";
const ID_BROCHA = "9f1e4a3d-5def-4c3c-92e1-a6927f974990";

const BOLSA: DatosBolsa = {
  productos: [
    {
      id: ID_BRILLO,
      referencia: "GLS735",
      nombre: "Brillo labial Oil Glazed Shine",
      imagenPrincipal: null,
      stock: 50,
      activo: true,
      escalones: [{ minCantidad: 1, precioUnitario: 8000 }],
      etiquetaVariante: "Tono",
      variantes: [
        { id: "v1", nombre: "Tono 1", colorHex: "#d3656e", orden: 1, agotado: false },
        { id: "v2", nombre: "Tono 2", colorHex: "#f63037", orden: 2, agotado: true },
      ],
    },
    {
      id: ID_BROCHA,
      referencia: "BRI-52",
      nombre: "Brocha para polvo",
      imagenPrincipal: null,
      stock: 50,
      activo: true,
      escalones: [{ minCantidad: 1, precioUnitario: 16000 }],
      etiquetaVariante: "Color",
      variantes: [],
    },
  ],
  reglas: [],
  umbralPorMayor: 200000,
};

const PEDIDO_CREADO = {
  order_id: "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11",
  numero_pedido: "AB-0099",
  subtotal: 32000,
  descuento: 0,
  porcentaje: 0,
  por_mayor: false,
  total: 32000,
  repetido: false,
};

type Item = { producto_id: string; cantidad: number; tono: string | null };
const ITEMS: Item[] = [
  { producto_id: ID_BRILLO, cantidad: 2, tono: "Tono 1" },
  { producto_id: ID_BROCHA, cantidad: 1, tono: null },
];

function formulario(cambios: Record<string, string> = {}): FormData {
  const datos = new FormData();
  const base = {
    nombre: "María Gómez",
    whatsapp: "+57 300 123 4567",
    ciudad: "Medellín",
    notas: "",
    items: JSON.stringify(ITEMS),
    clave: "6f1c2a9e-4d7b-4e3a-9c1f-2b8d7e6a5c4b",
  };
  for (const [clave, valor] of Object.entries({ ...base, ...cambios })) datos.set(clave, valor);
  return datos;
}

let consultas: ConsultaFalsa[] = [];

function usar(cambios: Record<string, RespuestaFalsa> = {}) {
  const respuestas: Record<string, RespuestaFalsa> = {
    "rpc:crear_pedido": { data: PEDIDO_CREADO, error: null },
    "from:orders": { data: null, error: null },
    "from:order_items": {
      data: [
        { referencia_snapshot: "GLS735", nombre_snapshot: "Brillo labial", tono_snapshot: "Tono 1", cantidad: 2, subtotal: 16000 },
      ],
      error: null,
    },
    ...cambios,
  };
  const falso = clienteFalso((c) => respuestas[c.origen] ?? { data: null, error: null });
  simulado.cliente = falso.cliente;
  consultas = falso.consultas;
}

const consulta = (origen: string) => consultas.find((c) => c.origen === origen);
const argumentosRpc = () => llamadas(consulta("rpc:crear_pedido"), "rpc")[0]?.[1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  simulado.despues = [];
  simulado.obtenerDatosBolsa.mockResolvedValue(BOLSA);
  simulado.enviarCorreoPedido.mockResolvedValue({ ok: true, id: "correo-1" });
  usar();
});

describe("confirmarPedido — datos de la clienta", () => {
  it("rechaza un nombre de más de 80 caracteres y marca el campo", async () => {
    const r = await confirmarPedido(null, formulario({ nombre: "a".repeat(81) }));

    expect(r).toMatchObject({ ok: false, campo: "nombre" });
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });

  it("rechaza un WhatsApp con menos de 7 dígitos y marca el campo", async () => {
    const r = await confirmarPedido(null, formulario({ whatsapp: "123" }));

    expect(r).toMatchObject({ ok: false, campo: "whatsapp" });
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });

  it("acepta el WhatsApp con espacios y +57", async () => {
    const r = await confirmarPedido(null, formulario({ whatsapp: "+57 300 123 4567" }));
    expect(r.ok).toBe(true);
  });

  it("rechaza una ciudad vacía o de más de 60 caracteres", async () => {
    expect(await confirmarPedido(null, formulario({ ciudad: "  " }))).toMatchObject({ ok: false, campo: "ciudad" });
    expect(await confirmarPedido(null, formulario({ ciudad: "b".repeat(61) }))).toMatchObject({
      ok: false,
      campo: "ciudad",
    });
  });

  it("rechaza una nota de más de 300 caracteres", async () => {
    const r = await confirmarPedido(null, formulario({ notas: "n".repeat(301) }));

    expect(r.ok).toBe(false);
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });
});

describe("confirmarPedido — la bolsa", () => {
  const GRANDE = mensajeAmable("PEDIDO_MUY_GRANDE").mensaje;

  it("con 41 líneas pide escribir por WhatsApp", async () => {
    const items = Array.from({ length: 41 }, () => ({ producto_id: ID_BROCHA, cantidad: 1, tono: null }));
    const r = await confirmarPedido(null, formulario({ items: JSON.stringify(items) }));

    expect(r).toMatchObject({ ok: false, mensaje: GRANDE, campo: "bolsa" });
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });

  it("con una línea de 51 unidades pide escribir por WhatsApp", async () => {
    const items = [{ producto_id: ID_BROCHA, cantidad: 51, tono: null }];
    const r = await confirmarPedido(null, formulario({ items: JSON.stringify(items) }));

    expect(r).toMatchObject({ ok: false, mensaje: GRANDE, campo: "bolsa" });
  });

  it("con más de 150 unidades en total pide escribir por WhatsApp", async () => {
    const items = Array.from({ length: 4 }, () => ({ producto_id: ID_BROCHA, cantidad: 40, tono: null }));
    const r = await confirmarPedido(null, formulario({ items: JSON.stringify(items) }));

    expect(r).toMatchObject({ ok: false, mensaje: GRANDE });
  });

  it("una bolsa ilegible o vacía se marca en la bolsa sin crear nada", async () => {
    expect(await confirmarPedido(null, formulario({ items: "{roto" }))).toMatchObject({ ok: false, campo: "bolsa" });
    expect(await confirmarPedido(null, formulario({ items: "[]" }))).toMatchObject({ ok: false, campo: "bolsa" });
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });

  it.each([
    ["agotada", "Tono 2"],
    ["inexistente", "Tono 9"],
    ["sin elegir", null],
  ])("una variante %s devuelve TONO_NO_DISPONIBLE y marca la bolsa", async (_, tono) => {
    const items = [{ producto_id: ID_BRILLO, cantidad: 1, tono }];
    const r = await confirmarPedido(null, formulario({ items: JSON.stringify(items) }));

    expect(r).toMatchObject({ ok: false, codigo: "TONO_NO_DISPONIBLE", campo: "bolsa" });
    expect(simulado.obtenerDatosBolsa).toHaveBeenCalledWith([ID_BRILLO]);
    expect(consulta("rpc:crear_pedido")).toBeUndefined();
  });
});

describe("confirmarPedido — pedido válido", () => {
  it("crea el pedido, registra la política, invalida el catálogo y deja el correo para después", async () => {
    const r = await confirmarPedido(null, formulario({ notas: "Es un regalo", adicional: "AB-0098" }));

    expect(r).toEqual({ ok: true, id: PEDIDO_CREADO.order_id, numero: "AB-0099", total: 32000 });

    const args = argumentosRpc();
    expect(String(args.p_notas).startsWith("[Adicional a AB-0098] ")).toBe(true);
    expect(args.p_notas).toBe("[Adicional a AB-0098] Es un regalo");
    expect(args).toMatchObject({
      p_nombre: "María Gómez",
      p_whatsapp: "+57 300 123 4567",
      p_ciudad: "Medellín",
      p_items: ITEMS,
      p_clave: "6f1c2a9e-4d7b-4e3a-9c1f-2b8d7e6a5c4b",
    });
    expect(String(args.p_ip_hash)).toMatch(/^[0-9a-f]{64}$/);

    // La política se registra después de crear el pedido, sobre ese pedido.
    const orden = consultas.map((c) => c.origen);
    expect(orden.indexOf("rpc:crear_pedido")).toBeLessThan(orden.indexOf("from:orders"));
    const [cambios] = llamadas(consulta("from:orders"), "update")[0] as [Record<string, unknown>];
    expect(cambios.politica_version).toBe("2026-11-10");
    expect(Number.isNaN(Date.parse(String(cambios.politica_aceptada_en)))).toBe(false);
    expect(llamadas(consulta("from:orders"), "eq")).toContainEqual(["id", PEDIDO_CREADO.order_id]);

    expect(simulado.revalidateTag).toHaveBeenCalledWith("catalogo", "max");

    expect(simulado.enviarCorreoPedido).not.toHaveBeenCalled();
    expect(simulado.despues).toHaveLength(1);
    await simulado.despues[0]();
    expect(simulado.enviarCorreoPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        numeroPedido: "AB-0099",
        nombre: "María Gómez",
        notas: "[Adicional a AB-0098] Es un regalo",
        total: 32000,
        lineas: [{ referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 1", cantidad: 2, subtotal: 16000 }],
      })
    );
  });

  it("sin nota, el adicional queda como nota; un número que no es de pedido se ignora", async () => {
    await confirmarPedido(null, formulario({ adicional: "AB-0098" }));
    expect(argumentosRpc().p_notas).toBe("[Adicional a AB-0098]");

    usar();
    await confirmarPedido(null, formulario({ adicional: "<b>hola</b>", notas: "Timbre 302" }));
    expect(argumentosRpc().p_notas).toBe("Timbre 302");

    usar();
    await confirmarPedido(null, formulario());
    expect(argumentosRpc().p_notas).toBeNull();
  });

  it("un reintento del mismo envío devuelve el pedido sin volver a avisar por correo", async () => {
    usar({ "rpc:crear_pedido": { data: { ...PEDIDO_CREADO, repetido: true }, error: null } });

    const r = await confirmarPedido(null, formulario());

    expect(r).toMatchObject({ ok: true, numero: "AB-0099" });
    expect(simulado.despues).toHaveLength(0);
    expect(simulado.enviarCorreoPedido).not.toHaveBeenCalled();
  });

  it("si registrar la política falla, el pedido igual queda confirmado", async () => {
    usar({ "from:orders": { data: null, error: { message: "sin red" } } });

    const r = await confirmarPedido(null, formulario());

    expect(r.ok).toBe(true);
  });
});

describe("confirmarPedido — errores de la base", () => {
  it("DEMASIADOS_PEDIDOS se traduce con mensajeAmable", async () => {
    usar({ "rpc:crear_pedido": { data: null, error: { message: "DEMASIADOS_PEDIDOS" } } });

    const r = await confirmarPedido(null, formulario());

    expect(r).toMatchObject({
      ok: false,
      mensaje: mensajeAmable("DEMASIADOS_PEDIDOS").mensaje,
      codigo: "DEMASIADOS_PEDIDOS",
    });
    expect(simulado.revalidateTag).not.toHaveBeenCalled();
  });

  it("SIN_STOCK con nombre y cantidad marca la bolsa con el mensaje concreto", async () => {
    usar({ "rpc:crear_pedido": { data: null, error: { message: "SIN_STOCK|Brillo labial|1" } } });

    const r = await confirmarPedido(null, formulario());

    expect(r).toMatchObject({
      ok: false,
      campo: "bolsa",
      codigo: "SIN_STOCK",
      mensaje: mensajeAmable("SIN_STOCK|Brillo labial|1").mensaje,
    });
  });

  it("una respuesta sin número de pedido no se da por confirmada", async () => {
    usar({ "rpc:crear_pedido": { data: { order_id: null }, error: null } });

    const r = await confirmarPedido(null, formulario());

    expect(r.ok).toBe(false);
  });
});
