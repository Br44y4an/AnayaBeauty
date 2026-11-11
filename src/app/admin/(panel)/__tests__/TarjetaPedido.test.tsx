// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Pedido } from "@/lib/types";
import { TarjetaPedido } from "../TarjetaPedido";

const PAGO = { metodo: "Nequi", numero: "3228813646", titular: "Anaya Beauty" };

function pedido(cambios: Partial<Pedido> = {}): Pedido {
  return {
    id: "8a1f2c3d-0000-4000-8000-000000000001",
    numeroPedido: "AB-0098",
    clienteNombre: "María Pérez",
    clienteWhatsapp: "300 123 4567",
    clienteCiudad: "Medellín",
    notasCliente: null,
    subtotal: 45000,
    descuento: 0,
    porcentajeDescuento: 0,
    porMayor: false,
    total: 45000,
    estado: "nuevo",
    notasAdmin: null,
    creadoEn: "2026-11-10T20:00:00.000Z",
    lineas: [
      { id: "l1", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 2", cantidad: 2, precioUnitarioAplicado: 7500, subtotal: 15000 },
      { id: "l2", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 5", cantidad: 1, precioUnitarioAplicado: 7500, subtotal: 7500 },
    ],
    ...cambios,
  };
}

function pintar(p: Pedido, extra: Partial<Parameters<typeof TarjetaPedido>[0]> = {}) {
  const alCambiar = vi.fn();
  const alPedirCancelar = vi.fn();
  render(
    <TarjetaPedido
      pedido={p}
      pago={PAGO}
      recienLlegado={false}
      guardando={null}
      enEspera={false}
      error={null}
      alCambiar={alCambiar}
      alPedirCancelar={alPedirCancelar}
      {...extra}
    />
  );
  return { alCambiar, alPedirCancelar };
}

describe("TarjetaPedido", () => {
  it("un pedido nuevo muestra el siguiente paso, cobrar, recibo y cancelar sin abrir nada", () => {
    const { alCambiar, alPedirCancelar } = pintar(pedido());

    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));
    expect(alCambiar).toHaveBeenCalledWith("pagado");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(alPedirCancelar).toHaveBeenCalled();

    const cobrar = screen.getByRole("link", { name: /Cobrar/ });
    const url = new URL(cobrar.getAttribute("href")!);
    expect(url.pathname).toBe("/573001234567");
    expect(url.searchParams.get("text")).toContain("AB-0098");
    expect(url.searchParams.get("text")).toContain("$45.000");
    expect(cobrar).toHaveAttribute("target", "_blank");

    expect(screen.getByRole("link", { name: "Recibo" })).toHaveAttribute(
      "href",
      "/admin/recibos?pedido=8a1f2c3d-0000-4000-8000-000000000001"
    );
    // Dos tonos del mismo producto: un producto, tres unidades.
    expect(screen.getByText("1 producto · 3 unidades", { exact: false })).toBeInTheDocument();
  });

  it("un pedido pagado ofrece «Marcar enviado»", () => {
    const { alCambiar } = pintar(pedido({ estado: "pagado" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar enviado" }));
    expect(alCambiar).toHaveBeenCalledWith("enviado");
  });

  it("un pedido enviado no se puede cancelar y ofrece avisar el envío", () => {
    pintar(pedido({ estado: "enviado" }));
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirmar pago|Marcar enviado/ })).toBeNull();
    const avisar = screen.getByRole("link", { name: /Avisar envío/ });
    expect(new URL(avisar.getAttribute("href")!).searchParams.get("text")).toContain("va en camino");
  });

  it("un cancelado no tiene acciones de estado", () => {
    pintar(pedido({ estado: "cancelado" }));
    expect(screen.queryByRole("button", { name: /Cancelar|Confirmar pago|Marcar enviado/ })).toBeNull();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("con un número que no es celular no ofrece WhatsApp (no cae en el del negocio)", () => {
    pintar(pedido({ clienteWhatsapp: "604 444 1234" }));
    expect(screen.queryByRole("link", { name: /Cobrar/ })).toBeNull();
  });

  it("destaca el pedido adicional y la nota de la clienta", () => {
    pintar(pedido({ notasCliente: "[Adicional a AB-0097] Es un regalo" }));
    expect(screen.getByText("Adicional a AB-0097.")).toBeInTheDocument();
    expect(screen.getByText(/Es un regalo/)).toBeInTheDocument();
    expect(screen.queryByText(/\[Adicional/)).toBeNull();
  });

  it("el error se lee con el botón y se anuncia", () => {
    pintar(pedido(), { error: "Este pedido ya no existe." });
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Este pedido ya no existe.");
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toHaveAttribute("aria-describedby", alerta.id);
  });

  it("mientras guarda, el botón de esa acción carga y los demás esperan", () => {
    pintar(pedido(), { guardando: "pagado" });
    const boton = screen.getByRole("button", { name: "Confirmar pago" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).not.toHaveAttribute("aria-busy");
  });

  it("al cancelar, la carga se ve en «Cancelar», no en el paso siguiente", () => {
    pintar(pedido(), { guardando: "cancelado" });
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Confirmar pago" })).not.toHaveAttribute("aria-busy");
  });

  it("marca el recién llegado", () => {
    pintar(pedido(), { recienLlegado: true });
    expect(screen.getByText("Recién llegado")).toBeInTheDocument();
  });
});
