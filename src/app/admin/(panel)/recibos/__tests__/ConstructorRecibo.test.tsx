// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
      pagoMetodo="Nequi"
      pagoNumero="3228813646"
      pagoTitular="Anaya Beauty"
      hoy="2026-11-10"
      numeroInicial="REC-20261110-123"
    />
  );
}

const vista = () => within(screen.getByRole("region", { name: "Vista previa" }));
const resumen = () => within(screen.getByRole("region", { name: "Resumen" }));
/** La fila «Total» (dt + dd) de una región: el subtotal puede tener la misma cifra. */
const totalEn = (region: ReturnType<typeof within>) => region.getByText("Total").parentElement!;
const descargar = () => screen.getByRole("button", { name: "Descargar PDF" });
const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

function agregarTexto(descripcion: string, cantidad: string, precio: string) {
  fireEvent.click(screen.getByRole("button", { name: "Agregar producto en texto" }));
  escribir("Descripción", descripcion);
  escribir("Cantidad", cantidad);
  escribir("Precio unitario", precio);
  fireEvent.click(screen.getByRole("button", { name: "Agregar al recibo" }));
}

beforeEach(() => localStorage.clear());

describe("ConstructorRecibo", () => {
  it("con ?pedido=id llega con el pedido elegido y listo para descargar", () => {
    pintar(PEDIDO.id);
    expect(screen.getByRole("combobox", { name: "Elige el pedido" })).toHaveValue(PEDIDO.id);
    expect(screen.getByLabelText("Nombre o razón social")).toHaveValue("Gloria Cárdenas");
    expect(screen.getByRole("spinbutton", { name: "Precio unitario de Espejo de mano" })).toHaveValue(18900);
    expect(vista().getByText("Recibo AB-0100")).toBeInTheDocument();
    expect(vista().getByText("10 de noviembre de 2026")).toBeInTheDocument();
    expect(descargar()).toBeEnabled();
  });

  it("sin pedido elegido no deja descargar y dice por qué", () => {
    pintar();
    expect(screen.getByRole("combobox", { name: "Elige el pedido" })).toHaveValue("");
    expect(descargar()).toBeDisabled();
    expect(descargar()).toHaveAccessibleDescription("Elige un pedido.");
  });

  it("un producto en texto sale en la vista previa y en el total, y se puede editar y quitar", () => {
    pintar(PEDIDO.id);
    agregarTexto("Envío a Pereira", "2", "6.000");

    expect(vista().getByText("Envío a Pereira")).toBeInTheDocument();
    expect(totalEn(resumen())).toHaveTextContent("$68.700");
    expect(totalEn(vista())).toHaveTextContent("$68.700");

    fireEvent.click(screen.getByRole("button", { name: "Editar Envío a Pereira" }));
    escribir("Precio unitario", "5000");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(totalEn(resumen())).toHaveTextContent("$66.700");

    fireEvent.click(screen.getByRole("button", { name: "Quitar Envío a Pereira" }));
    expect(vista().queryByText("Envío a Pereira")).not.toBeInTheDocument();
    expect(totalEn(resumen())).toHaveTextContent("$56.700");
  });

  it("no agrega un producto en texto sin descripción y explica junto al campo", () => {
    pintar(PEDIDO.id);
    agregarTexto("  ", "1", "1000");

    const campo = screen.getByLabelText("Descripción");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(expect.stringContaining("Escribe qué producto o servicio es."));
    expect(document.activeElement).toBe(campo);
  });

  it("el recibo de un pedido puede ir a nombre de otra persona y volver a los datos del pedido", () => {
    pintar(PEDIDO.id);
    expect(screen.queryByRole("button", { name: "Volver a los datos del pedido" })).not.toBeInTheDocument();

    escribir("Nombre o razón social", "Distribuidora Luna SAS");
    escribir("Documento o NIT (opcional)", "NIT 900.123.456-7");
    expect(vista().getByText("Distribuidora Luna SAS")).toBeInTheDocument();
    expect(vista().getByText("Documento: NIT 900.123.456-7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a los datos del pedido" }));
    expect(screen.getByLabelText("Nombre o razón social")).toHaveValue("Gloria Cárdenas");
    expect(screen.getByLabelText("Documento o NIT (opcional)")).toHaveValue("");
    expect(vista().getByText("Gloria Cárdenas")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre o razón social"));
  });

  it("el título personalizado sale en la vista previa, se recuerda y se restablece", () => {
    pintar(PEDIDO.id);
    escribir("Título", "Cuenta de cobro");
    expect(vista().getByText("Cuenta de cobro AB-0100")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("anaya-recibo-preferencias")!)).toMatchObject({ titulo: "Cuenta de cobro" });

    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Recibo");
    expect(vista().getByText("Recibo AB-0100")).toBeInTheDocument();
  });

  it("al abrir usa el título, la nota y la casilla de pago recordados", () => {
    localStorage.setItem(
      "anaya-recibo-preferencias",
      JSON.stringify({ titulo: "Cotización", nota: "Precios válidos por 8 días.", mostrarPago: false })
    );
    pintar(PEDIDO.id);

    expect(screen.getByLabelText("Título")).toHaveValue("Cotización");
    expect(vista().getByText("Cotización AB-0100")).toBeInTheDocument();
    expect(vista().getByText("Precios válidos por 8 días.")).toBeInTheDocument();
    expect(vista().queryByText("Gracias por comprar en Anaya Beauty.")).not.toBeInTheDocument();
    expect(vista().queryByText("Para completar tu pago")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Mostrar los datos de pago" }));
    expect(vista().getByText("Para completar tu pago")).toBeInTheDocument();
    expect(vista().getByText("Nequi 3228813646")).toBeInTheDocument();
  });

  it("en el recibo manual «Descargar PDF» espera el nombre y al menos un producto", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: "Recibo manual" }));
    expect(descargar()).toBeDisabled();
    expect(descargar()).toHaveAccessibleDescription("Falta el nombre en «Dirigido a» y agregar al menos un producto.");

    agregarTexto("Servicio de maquillaje", "1", "80000");
    expect(descargar()).toBeDisabled();
    expect(descargar()).toHaveAccessibleDescription("Falta el nombre en «Dirigido a».");

    escribir("Nombre o razón social", "Ana Gómez");
    expect(descargar()).toBeEnabled();
    expect(vista().getByText("REC-20261110-123", { exact: false })).toBeInTheDocument();
    expect(vista().queryByText(/Ref\./)).not.toBeInTheDocument();
  });
});
