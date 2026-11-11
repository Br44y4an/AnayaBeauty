// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Component, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SIN_CONEXION_ESTADO } from "@/lib/admin/pedidos";
import type { Pedido } from "@/lib/types";

const prueba = vi.hoisted(() => ({ cambiar: vi.fn() }));

vi.mock("../acciones-pedidos", () => ({ cambiarEstadoPedido: prueba.cambiar }));
vi.mock("../PedidosEnVivo", () => ({ useEnVivo: () => ({ abiertoDesde: Date.parse("2026-11-10T19:00:00Z") }) }));

import { Avisos } from "@/components/ui/Avisos";
import { cerrarAviso } from "@/lib/avisos";
import { TablaPedidos } from "../TablaPedidos";

const PAGO = { metodo: null, numero: null, titular: null };

function pedido(id: string, cambios: Partial<Pedido> = {}): Pedido {
  return {
    id,
    numeroPedido: `AB-${id.slice(-4)}`,
    clienteNombre: "María Pérez",
    clienteWhatsapp: "3001234567",
    clienteCiudad: "Medellín",
    notasCliente: null,
    subtotal: 15000,
    descuento: 0,
    porcentajeDescuento: 0,
    porMayor: false,
    total: 15000,
    estado: "nuevo",
    notasAdmin: null,
    creadoEn: "2026-11-10T20:00:00.000Z",
    lineas: [{ id: `l-${id}`, referencia: "GLS735", nombre: "Brillo", tono: "Tono 2", cantidad: 2, precioUnitarioAplicado: 7500, subtotal: 15000 }],
    ...cambios,
  };
}

const A = "8a1f2c3d-0000-4000-8000-000000000098";
const B = "8a1f2c3d-0000-4000-8000-000000000097";

function pintar(pedidos: Pedido[]) {
  render(
    <>
      <TablaPedidos pedidos={pedidos} pago={PAGO} />
      <Avisos />
    </>
  );
}

beforeEach(() => {
  prueba.cambiar.mockReset().mockResolvedValue({ ok: true });
  act(() => cerrarAviso());
});

describe("TablaPedidos", () => {
  it("confirmar el pago avisa y «Deshacer» lo devuelve a nuevo", async () => {
    pintar([pedido(A)]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));

    await waitFor(() => expect(screen.getByText("Pago confirmado")).toBeInTheDocument());
    expect(prueba.cambiar).toHaveBeenCalledWith(A, "pagado");

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(prueba.cambiar).toHaveBeenLastCalledWith(A, "nuevo"));
    await waitFor(() => expect(screen.getByText("Volvió a nuevo")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
  });

  it("cancelar pide confirmación; «No» no toca nada y «Sí» cancela sin ofrecer deshacer", async () => {
    pintar([pedido(A)]);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = screen.getByRole("dialog", { name: "¿Cancelar el pedido AB-0098?" });
    expect(dialogo).toHaveTextContent("Las 2 unidades vuelven al inventario");
    fireEvent.click(within(dialogo).getByRole("button", { name: "No, dejarlo así" }));
    expect(prueba.cambiar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar pedido" }));
    await waitFor(() => expect(screen.getByText("Pedido cancelado")).toBeInTheDocument());
    expect(prueba.cambiar).toHaveBeenCalledWith(A, "cancelado");
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
  });

  it("si la base lo rechaza, el error queda en la tarjeta de ese pedido", async () => {
    prueba.cambiar.mockResolvedValue({ ok: false, error: "Este pedido ya no existe." });
    pintar([pedido(A), pedido(B)]);

    const tarjetaA = screen.getByRole("article", { name: "AB-0098" });
    fireEvent.click(within(tarjetaA).getByRole("button", { name: "Confirmar pago" }));

    await waitFor(() => expect(within(tarjetaA).getByRole("alert")).toHaveTextContent("Este pedido ya no existe."));
    expect(within(screen.getByRole("article", { name: "AB-0097" })).queryByRole("alert")).toBeNull();
  });

  describe("sin conexión (la acción rechaza: «Failed to fetch»)", () => {
    // El límite de error del panel taparía la lista: si se pinta, la prueba lo detecta.
    class Limite extends Component<{ children: ReactNode }, { fallo: boolean }> {
      state = { fallo: false };
      static getDerivedStateFromError() {
        return { fallo: true };
      }
      render() {
        return this.state.fallo ? <p>Algo no cargó bien</p> : this.props.children;
      }
    }

    function pintarConLimite(pedidos: Pedido[]) {
      render(
        <Limite>
          <TablaPedidos pedidos={pedidos} pago={PAGO} />
          <Avisos />
        </Limite>
      );
    }

    it("confirmar el pago deja el error en esa tarjeta y la lista sigue a la vista", async () => {
      prueba.cambiar.mockRejectedValue(new TypeError("Failed to fetch"));
      pintarConLimite([pedido(A), pedido(B)]);

      const tarjetaA = screen.getByRole("article", { name: "AB-0098" });
      fireEvent.click(within(tarjetaA).getByRole("button", { name: "Confirmar pago" }));

      await waitFor(() => expect(within(tarjetaA).getByRole("alert")).toHaveTextContent(SIN_CONEXION_ESTADO));
      expect(screen.queryByText("Algo no cargó bien")).toBeNull();
      expect(screen.getByRole("article", { name: "AB-0097" })).toBeInTheDocument();
      expect(within(screen.getByRole("article", { name: "AB-0097" })).queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Pago confirmado")).toBeNull();
      // Se puede reintentar en cuanto termina la transición.
      await waitFor(() => expect(within(tarjetaA).getByRole("button", { name: "Confirmar pago" })).toBeEnabled());
    });

    it("cancelar sin conexión deja el error en la tarjeta", async () => {
      prueba.cambiar.mockRejectedValue(new TypeError("Failed to fetch"));
      pintarConLimite([pedido(A)]);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar pedido" }));

      const tarjetaA = screen.getByRole("article", { name: "AB-0098" });
      await waitFor(() => expect(within(tarjetaA).getByRole("alert")).toHaveTextContent(SIN_CONEXION_ESTADO));
      expect(screen.queryByText("Algo no cargó bien")).toBeNull();
      expect(screen.queryByText("Pedido cancelado")).toBeNull();
    });

    it("«Deshacer» sin conexión deja el error en la tarjeta", async () => {
      pintarConLimite([pedido(A)]);
      fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));
      await waitFor(() => expect(screen.getByText("Pago confirmado")).toBeInTheDocument());

      prueba.cambiar.mockRejectedValue(new TypeError("Failed to fetch"));
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

      const tarjetaA = screen.getByRole("article", { name: "AB-0098" });
      await waitFor(() => expect(within(tarjetaA).getByRole("alert")).toHaveTextContent(SIN_CONEXION_ESTADO));
      expect(prueba.cambiar).toHaveBeenLastCalledWith(A, "nuevo");
      expect(screen.queryByText("Algo no cargó bien")).toBeNull();
    });
  });

  it("resalta solo los nuevos que llegaron con el panel abierto", () => {
    pintar([
      pedido(A, { creadoEn: "2026-11-10T19:30:00Z" }),
      pedido(B, { creadoEn: "2026-11-10T18:00:00Z" }),
    ]);
    expect(within(screen.getByRole("article", { name: "AB-0098" })).getByText("Recién llegado")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "AB-0097" })).queryByText("Recién llegado")).toBeNull();
  });
});
