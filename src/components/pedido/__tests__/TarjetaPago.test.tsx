// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TarjetaPago } from "@/components/pedido/TarjetaPago";
import { pesos } from "@/lib/format";
import type { ConfiguracionPublica } from "@/lib/types";

const PEDIDO = {
  id: "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11",
  numeroPedido: "AB-0098",
  total: 45000,
  clienteNombre: "María Gómez",
};
const PAGO = { metodo: "Nequi", numero: "300 765 4321", titular: "Anaya Beauty" };
const ENVIO = "El envío se coordina por WhatsApp después de confirmar tu pedido.";

function montar(pago: ConfiguracionPublica["pago"] = PAGO) {
  return render(
    <TarjetaPago pedido={PEDIDO} pago={pago} envioInfo={ENVIO} whatsappNegocio="573001112233" />
  );
}

afterEach(() => vi.restoreAllMocks());

describe("TarjetaPago", () => {
  it("«Ya pagué: enviar comprobante» abre el WhatsApp del negocio con el pedido, el total y su enlace", () => {
    montar();

    const enlace = screen.getByRole("link", { name: "Ya pagué: enviar comprobante" });
    const url = new URL(enlace.getAttribute("href") ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/573001112233");
    expect(enlace).toHaveAttribute("target", "_blank");

    const texto = url.searchParams.get("text") ?? "";
    expect(texto).toContain("AB-0098");
    expect(texto).toContain(pesos(45000));
    expect(texto).toContain(`${window.location.origin}/pedido/${PEDIDO.id}`);
    expect(texto).toBe(
      `Hola, soy María Gómez. Ya pagué mi pedido AB-0098 por $45.000. Te envío el comprobante. ${window.location.origin}/pedido/${PEDIDO.id}`
    );
  });

  it("dice cuánto y por dónde transferir, con el titular y el envío", () => {
    montar();

    expect(screen.getByText("Transfiere $45.000 por Nequi")).toBeInTheDocument();
    expect(screen.getByText("300 765 4321")).toBeInTheDocument();
    expect(screen.getByText("Titular: Anaya Beauty")).toBeInTheDocument();
    expect(screen.getByText(`Envío: ${ENVIO}`)).toBeInTheDocument();
  });

  it("copia el número de pago y el valor sin puntos", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
    montar();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copiar" })));
    expect(escribir).toHaveBeenLastCalledWith("300 765 4321");
    expect(screen.getAllByText("Copiado").length).toBeGreaterThan(0);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copiar valor" })));
    expect(escribir).toHaveBeenLastCalledWith("45000");
  });

  it("sin datos de pago dice que los enviamos por WhatsApp y no pinta huecos", () => {
    montar({ metodo: null, numero: null, titular: null });

    expect(screen.getByText("Te enviamos los datos de pago por WhatsApp")).toBeInTheDocument();
    expect(screen.queryByText(/Titular/)).not.toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ya pagué: enviar comprobante" })).toBeInTheDocument();
  });

  it("con número pero sin método no deja «por null»", () => {
    montar({ metodo: null, numero: "300 765 4321", titular: null });

    expect(screen.getByText("Transfiere $45.000 a esta cuenta")).toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
  });
});
