import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, llamadas, type ConsultaFalsa, type RespuestaFalsa } from "./supabase-falso";

vi.mock("server-only", () => ({}));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: (f: unknown) => f }));
const estado = vi.hoisted(() => ({ cliente: null as unknown, exigir: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ clienteAdmin: () => estado.cliente }));
vi.mock("@/lib/admin/sesion", () => ({ exigirAdmin: estado.exigir }));

import { LIMITE_PEDIDOS, listarPedidos, mapearPedido, obtenerPedidoAdmin } from "@/lib/data/orders";

const linea = (id: string, ref: string, tono: string | null) => ({
  id,
  referencia_snapshot: ref,
  nombre_snapshot: `Producto ${ref}`,
  tono_snapshot: tono,
  cantidad: 2,
  precio_unitario_aplicado: 5000,
  subtotal: 10000,
});

const fila = (extra: object = {}) => ({
  id: "p1",
  numero_pedido: "AB-0001",
  cliente_nombre: "María",
  cliente_whatsapp: "3001234567",
  cliente_ciudad: "Cali",
  subtotal: 20000,
  descuento: 2000,
  porcentaje_descuento: 10,
  por_mayor: true,
  total: 18000,
  estado: "nuevo",
  notas_admin: null,
  notas_cliente: "  regalo  ",
  created_at: "2026-11-10T20:00:00Z",
  order_items: [linea("l1", "B2", "Tono 10"), linea("l2", "A1", null), linea("l3", "B2", "Tono 2")],
  ...extra,
});

let consultas: ConsultaFalsa[] = [];
function usar(r: (c: ConsultaFalsa) => RespuestaFalsa) {
  const f = clienteFalso(r);
  estado.cliente = f.cliente;
  consultas = f.consultas;
}

beforeEach(() => {
  estado.exigir.mockReset().mockResolvedValue({ userId: "u" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mapearPedido", () => {
  it("convierte la fila y ordena las líneas por referencia y tono numérico", () => {
    const p = mapearPedido(fila() as never);
    expect(p).toMatchObject({
      numeroPedido: "AB-0001",
      clienteNombre: "María",
      notasCliente: "regalo",
      subtotal: 20000,
      descuento: 2000,
      porcentajeDescuento: 10,
      porMayor: true,
      creadoEn: "2026-11-10T20:00:00Z",
    });
    expect(p.lineas.map((l) => [l.referencia, l.tono])).toEqual([
      ["A1", null],
      ["B2", "Tono 2"],
      ["B2", "Tono 10"],
    ]);
  });

  it("completa los datos de pedidos antiguos: subtotal 0, descuentos nulos, sin líneas", () => {
    const p = mapearPedido(
      fila({ subtotal: 0, descuento: null, porcentaje_descuento: null, por_mayor: null, notas_cliente: "  ", order_items: null }) as never
    );
    expect(p).toMatchObject({ subtotal: 18000, descuento: 0, porcentajeDescuento: 0, porMayor: false, notasCliente: null, lineas: [] });
  });
});

describe("listarPedidos", () => {
  it("exige administradora, ordena por más reciente, limita y filtra por estado", async () => {
    usar(() => ({ data: [fila()], error: null }));
    const r = await listarPedidos({ estado: "nuevo" });
    expect(estado.exigir).toHaveBeenCalled();
    expect(r).toHaveLength(1);
    const c = consultas[0];
    expect(c.origen).toBe("from:orders");
    expect(llamadas(c, "order")[0]).toEqual(["created_at", { ascending: false }]);
    expect(llamadas(c, "limit")[0]).toEqual([LIMITE_PEDIDOS]);
    expect(llamadas(c, "eq")[0]).toEqual(["estado", "nuevo"]);
    expect(llamadas(c, "or")).toHaveLength(0);
  });

  it("con búsqueda agrega el filtro or", async () => {
    usar(() => ({ data: [], error: null }));
    await listarPedidos({ busqueda: "AB-0001" });
    expect(llamadas(consultas[0], "or")).toHaveLength(1);
  });

  it("si la base falla lanza en vez de devolver vacío", async () => {
    usar(() => ({ data: null, error: { message: "x" } }));
    await expect(listarPedidos()).rejects.toThrow("No se pudieron cargar los pedidos.");
  });
});

describe("obtenerPedidoAdmin", () => {
  it("no consulta con un id que no es UUID", async () => {
    usar(() => ({ data: null, error: null }));
    await expect(obtenerPedidoAdmin("no-es-uuid")).resolves.toBeNull();
    expect(consultas).toHaveLength(0);
  });

  it("devuelve null si no existe y el pedido mapeado si existe", async () => {
    const id = "8a1f2c3d-0000-4000-8000-000000000001";
    usar(() => ({ data: null, error: null }));
    await expect(obtenerPedidoAdmin(id)).resolves.toBeNull();
    usar(() => ({ data: fila(), error: null }));
    await expect(obtenerPedidoAdmin(id)).resolves.toMatchObject({ numeroPedido: "AB-0001" });
  });
});
