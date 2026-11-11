import { describe, it, expect, vi, beforeEach } from "vitest";

const prueba = vi.hoisted(() => ({
  orden: [] as string[],
  rpc: vi.fn(),
  refresh: vi.fn(),
  invalidarCatalogo: vi.fn(),
  exigirAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: prueba.refresh }));
vi.mock("@/lib/admin/sesion", () => ({ exigirAdmin: prueba.exigirAdmin }));
vi.mock("@/lib/data/invalidar", () => ({ invalidarCatalogo: prueba.invalidarCatalogo }));
vi.mock("@/lib/supabase/admin", () => ({ clienteAdmin: () => ({ rpc: prueba.rpc }) }));

import { cambiarEstadoPedido } from "../acciones-pedidos";

const ID = "8a1f2c3d-0000-4000-8000-000000000001";

beforeEach(() => {
  prueba.orden = [];
  prueba.exigirAdmin.mockReset().mockImplementation(async () => {
    prueba.orden.push("exigirAdmin");
    return { userId: "u" };
  });
  prueba.rpc.mockReset().mockImplementation(async () => {
    prueba.orden.push("rpc");
    return { data: null, error: null };
  });
  prueba.refresh.mockReset();
  prueba.invalidarCatalogo.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cambiarEstadoPedido", () => {
  it("exige una administradora antes de tocar la base y pasa por cambiar_estado_pedido", async () => {
    await expect(cambiarEstadoPedido(ID, "pagado")).resolves.toEqual({ ok: true });
    expect(prueba.orden).toEqual(["exigirAdmin", "rpc"]);
    expect(prueba.rpc).toHaveBeenCalledWith("cambiar_estado_pedido", { p_order_id: ID, p_estado: "pagado" });
    expect(prueba.refresh).toHaveBeenCalled();
    expect(prueba.invalidarCatalogo).not.toHaveBeenCalled();
  });

  it("al cancelar invalida el catálogo: el stock volvió", async () => {
    await cambiarEstadoPedido(ID, "cancelado");
    expect(prueba.invalidarCatalogo).toHaveBeenCalledTimes(1);
  });

  it("si la sesión no es de administradora, no llega a la base", async () => {
    prueba.exigirAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(cambiarEstadoPedido(ID, "pagado")).rejects.toThrow("NEXT_REDIRECT");
    expect(prueba.rpc).not.toHaveBeenCalled();
  });

  it("rechaza ids y estados que no existen sin llamar a la base", async () => {
    expect(await cambiarEstadoPedido("1; drop", "pagado")).toMatchObject({ ok: false });
    expect(await cambiarEstadoPedido(ID, "borrado" as never)).toMatchObject({ ok: false });
    expect(prueba.rpc).not.toHaveBeenCalled();
  });

  it("traduce el error de la base a texto amable y refresca para mostrar el estado real", async () => {
    prueba.rpc.mockResolvedValue({
      data: null,
      error: { message: "TRANSICION_INVALIDA", details: "enviado -> cancelado", code: "P0001" },
    });
    await expect(cambiarEstadoPedido(ID, "cancelado")).resolves.toEqual({
      ok: false,
      error: "Un pedido enviado ya no se puede cancelar.",
    });
    expect(prueba.invalidarCatalogo).not.toHaveBeenCalled();
    expect(prueba.refresh).toHaveBeenCalled();
  });
});
