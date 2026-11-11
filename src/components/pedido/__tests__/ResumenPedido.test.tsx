// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ResumenPedido } from "@/components/pedido/ResumenPedido";
import type { Pedido } from "@/lib/types";

const PEDIDO: Pedido = {
  id: "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11",
  numeroPedido: "AB-0098",
  clienteNombre: "María Gómez",
  clienteWhatsapp: "300 123 4567",
  clienteCiudad: "Medellín",
  notasCliente: "[Adicional a AB-0097] Es un regalo",
  subtotal: 38500,
  descuento: 0,
  porcentajeDescuento: 0,
  porMayor: false,
  total: 38500,
  estado: "nuevo",
  notasAdmin: null,
  creadoEn: "2026-11-10T20:00:00.000Z",
  lineas: [
    { id: "l1", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 1", cantidad: 2, precioUnitarioAplicado: 7500, subtotal: 15000 },
    { id: "l2", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 3", cantidad: 1, precioUnitarioAplicado: 7500, subtotal: 7500 },
    { id: "l3", referencia: "BRI-52", nombre: "Brocha para polvo", tono: null, cantidad: 1, precioUnitarioAplicado: 16000, subtotal: 16000 },
  ],
};

describe("ResumenPedido", () => {
  it("junta las variantes de un producto con su precio y subtotal", () => {
    render(<ResumenPedido pedido={PEDIDO} />);

    const productos = screen.getAllByRole("listitem").filter((li) => li.querySelector("ul"));
    expect(productos).toHaveLength(1);
    const brillo = productos[0];
    expect(within(brillo).getByText("Brillo labial")).toBeInTheDocument();
    expect(within(brillo).getByText("Ref. GLS735")).toBeInTheDocument();
    expect(within(brillo).getByText("3 unidades · $7.500 c/u")).toBeInTheDocument();
    expect(within(brillo).getByText("$22.500")).toBeInTheDocument();
    expect(within(brillo).getByText("Tono 1")).toBeInTheDocument();
    expect(within(brillo).getByText("× 2")).toBeInTheDocument();

    expect(screen.getByText("1 unidad · $16.000 c/u")).toBeInTheDocument();
  });

  it("muestra a nombre de quién va, la ciudad, el WhatsApp y la nota", () => {
    render(<ResumenPedido pedido={PEDIDO} />);

    expect(screen.getByText("María Gómez")).toBeInTheDocument();
    expect(screen.getByText(/Medellín/)).toHaveTextContent("Medellín · WhatsApp 300 123 4567");
    expect(screen.getByText(/Es un regalo/)).toHaveTextContent("Nota: [Adicional a AB-0097] Es un regalo");
  });

  it("sin beneficios solo muestra «Total productos»", () => {
    render(<ResumenPedido pedido={{ ...PEDIDO, notasCliente: null }} />);

    expect(screen.getByText("Total productos")).toBeInTheDocument();
    expect(screen.getByText("$38.500")).toBeInTheDocument();
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
    expect(screen.queryByText(/Descuento/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nota/)).not.toBeInTheDocument();
  });

  it("con descuento y precio por mayor muestra el desglose", () => {
    render(
      <ResumenPedido
        pedido={{ ...PEDIDO, subtotal: 210000, porMayor: true, porcentajeDescuento: 5, descuento: 10500, total: 199500 }}
      />
    );

    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("$210.000")).toBeInTheDocument();
    expect(screen.getByText("Precio por mayor aplicado")).toBeInTheDocument();
    expect(screen.getByText("Descuento (5 %)")).toBeInTheDocument();
    expect(screen.getByText("−$10.500")).toBeInTheDocument();
    expect(screen.getByText("$199.500")).toBeInTheDocument();
  });
});
