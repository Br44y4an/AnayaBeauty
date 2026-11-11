import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, llamadas, type ConsultaFalsa, type RespuestaFalsa } from "./supabase-falso";

vi.mock("server-only", () => ({}));
const estado = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ clienteAdmin: () => estado.cliente }));

import { obtenerPedidoPublico } from "@/lib/data/pedido-publico";

const ID = "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11";

const FILA = {
  id: ID,
  numero_pedido: "AB-0098",
  cliente_nombre: "María Gómez",
  cliente_whatsapp: "300 123 4567",
  cliente_ciudad: "Medellín",
  notas_cliente: "Es un regalo",
  subtotal: 47500,
  descuento: 2375,
  porcentaje_descuento: 5,
  por_mayor: false,
  total: 45125,
  estado: "nuevo",
  created_at: "2026-11-10T20:00:00.000Z",
  order_items: [
    { id: "l3", referencia_snapshot: "GLS735", nombre_snapshot: "Brillo labial", tono_snapshot: "Tono 10", cantidad: 1, precio_unitario_aplicado: 7500, subtotal: 7500 },
    { id: "l1", referencia_snapshot: "BRI-52", nombre_snapshot: "Brocha", tono_snapshot: null, cantidad: 1, precio_unitario_aplicado: 16000, subtotal: 16000 },
    { id: "l2", referencia_snapshot: "GLS735", nombre_snapshot: "Brillo labial", tono_snapshot: "Tono 2", cantidad: 3, precio_unitario_aplicado: 7500, subtotal: 22500 },
  ],
};

let consultas: ConsultaFalsa[] = [];

function usar(respuesta: RespuestaFalsa) {
  const falso = clienteFalso(() => respuesta);
  estado.cliente = falso.cliente;
  consultas = falso.consultas;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  usar({ data: FILA, error: null });
});

describe("obtenerPedidoPublico", () => {
  it("con un id que no es UUID devuelve null sin consultar la base", async () => {
    expect(await obtenerPedidoPublico("AB-0098")).toBeNull();
    expect(await obtenerPedidoPublico("../admin")).toBeNull();
    expect(consultas).toHaveLength(0);
  });

  it("no pide datos de administración", async () => {
    await obtenerPedidoPublico(ID);

    const [campos] = llamadas(consultas[0], "select")[0] as [string];
    for (const privado of ["notas_admin", "ip_hash", "clave_idempotencia", "access_codes", "code_id"]) {
      expect(campos).not.toContain(privado);
    }
    expect(llamadas(consultas[0], "eq")).toContainEqual(["id", ID]);
  });

  it("devuelve el pedido con sus líneas juntas por producto y en orden de tono", async () => {
    const pedido = await obtenerPedidoPublico(ID);

    expect(pedido).toMatchObject({
      id: ID,
      numeroPedido: "AB-0098",
      clienteNombre: "María Gómez",
      notasCliente: "Es un regalo",
      subtotal: 47500,
      descuento: 2375,
      porcentajeDescuento: 5,
      total: 45125,
      estado: "nuevo",
      notasAdmin: null,
    });
    expect(pedido?.lineas.map((l) => `${l.referencia} ${l.tono ?? ""}`.trim())).toEqual([
      "BRI-52",
      "GLS735 Tono 2",
      "GLS735 Tono 10",
    ]);
  });

  it("un pedido viejo sin subtotal guardado no muestra $0", async () => {
    usar({ data: { ...FILA, subtotal: 0, descuento: 0, porcentaje_descuento: 0, total: 124000 }, error: null });

    const pedido = await obtenerPedidoPublico(ID);

    expect(pedido?.subtotal).toBe(124000);
  });

  it("entrega la fecha en ISO estándar aunque Postgres traiga microsegundos", async () => {
    usar({ data: { ...FILA, created_at: "2026-08-24T01:53:22.540566+00:00" }, error: null });

    const pedido = await obtenerPedidoPublico(ID);

    expect(pedido?.creadoEn).toBe("2026-08-24T01:53:22.540Z");
  });

  it("si el pedido no existe devuelve null", async () => {
    usar({ data: null, error: null });
    expect(await obtenerPedidoPublico(ID)).toBeNull();
  });

  it("si la base falla lanza, para que la página ofrezca reintentar", async () => {
    usar({ data: null, error: { message: "sin red" } });
    await expect(obtenerPedidoPublico(ID)).rejects.toThrow();
  });
});
