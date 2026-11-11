// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Pedido } from "@/lib/types";
import { ConstructorRecibo } from "../ConstructorRecibo";

const PEDIDO: Pedido = {
  id: "8a1f2c3d-0000-4000-8000-000000000002",
  numeroPedido: "AB-0100",
  clienteNombre: "Gloria Cárdenas",
  clienteWhatsapp: "3105551234",
  clienteCiudad: "Pereira",
  notasCliente: null,
  subtotal: 56700,
  descuento: 0,
  porcentajeDescuento: 0,
  porMayor: false,
  total: 56700,
  estado: "pagado",
  notasAdmin: null,
  creadoEn: "2026-11-10T20:00:00.000Z",
  lineas: [{ id: "l1", referencia: "AC80/150", nombre: "Espejo de mano", tono: null, cantidad: 3, precioUnitarioAplicado: 18900, subtotal: 56700 }],
};

function pintar(pedidoInicial?: string) {
  render(
    <ConstructorRecibo
      pedidos={[PEDIDO]}
      pedidoInicial={pedidoInicial}
      productos={[]}
      reglas={[]}
      umbralPorMayor={200000}
      pagoMetodo={null}
      pagoNumero={null}
      pagoTitular={null}
    />
  );
}

describe("ConstructorRecibo", () => {
  it("con ?pedido=id llega con el pedido elegido y listo para descargar", () => {
    pintar(PEDIDO.id);
    expect(screen.getByRole("combobox", { name: "Elige el pedido" })).toHaveValue(PEDIDO.id);
    expect(screen.getByText("Gloria Cárdenas")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Precio unitario de Espejo de mano" })).toHaveValue(18900);
    expect(screen.getByRole("button", { name: "Descargar recibo en PDF" })).toBeEnabled();
  });

  it("sin pedido elegido no deja descargar", () => {
    pintar();
    expect(screen.getByRole("combobox", { name: "Elige el pedido" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Descargar recibo en PDF" })).toBeDisabled();
  });
});
