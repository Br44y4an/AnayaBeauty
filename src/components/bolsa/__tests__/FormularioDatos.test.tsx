// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const navegacion = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navegacion.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));
const servidor = vi.hoisted(() => ({ confirmarPedido: vi.fn() }));
vi.mock("@/app/(tienda)/carrito/actions", () => servidor);

import { FormularioDatos, useDatosFormulario } from "@/components/bolsa/FormularioDatos";
import { useConfirmarPedido } from "@/hooks/useConfirmarPedido";
import { useCarrito } from "@/lib/cart";

const ITEMS = JSON.stringify([{ producto_id: "00000000-0000-4000-8000-00000000000b", cantidad: 1, tono: null }]);
const GUARDADOS = { nombre: "María Gómez", whatsapp: "300 123 4567", ciudad: "Medellín" };
const EXITO = { ok: true, id: "pedido-1", numero: "AB-0100", total: 16000 };

function Prueba() {
  const [valores, cambiar] = useDatosFormulario();
  const { accion, resultado } = useConfirmarPedido();
  return (
    <FormularioDatos
      valores={valores}
      onCambiar={cambiar}
      accion={accion}
      items={ITEMS}
      adicional={null}
      error={resultado && !resultado.ok ? resultado : null}
      whatsappNegocio="573001112233"
    />
  );
}

const recordar = () => screen.getByRole("checkbox", { name: "Recordar mis datos en este celular" });
const enviar = () => fireEvent.submit(screen.getByRole("form", { name: "Tus datos" }));
const guardados = () => JSON.parse(localStorage.getItem("anaya-datos") ?? "null");

function escribir() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: GUARDADOS.nombre } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: GUARDADOS.whatsapp } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: GUARDADOS.ciudad } });
}

beforeEach(() => {
  localStorage.clear();
  useCarrito.getState().vaciar();
  useCarrito.getState().agregar("00000000-0000-4000-8000-00000000000b", 1);
  navegacion.push.mockReset();
  servidor.confirmarPedido.mockReset();
  servidor.confirmarPedido.mockResolvedValue(EXITO);
});

afterEach(() => vi.restoreAllMocks());

describe("FormularioDatos", () => {
  it("con datos guardados en el celular los rellena y deja «Recordar» marcado", () => {
    localStorage.setItem("anaya-datos", JSON.stringify(GUARDADOS));
    render(<Prueba />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("María Gómez");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("300 123 4567");
    expect(screen.getByLabelText("Ciudad")).toHaveValue("Medellín");
    expect(recordar()).toBeChecked();
  });

  it("sin datos guardados empieza vacío, con «Recordar» desmarcado y sin placeholders", () => {
    render(<Prueba />);

    for (const campo of ["Nombre", "WhatsApp", "Ciudad"]) {
      expect(screen.getByLabelText(campo)).toHaveValue("");
      expect(screen.getByLabelText(campo)).not.toHaveAttribute("placeholder");
    }
    expect(recordar()).not.toBeChecked();
    expect(screen.getByLabelText("WhatsApp")).toHaveAccessibleDescription(/Ej\.: 300 123 4567/);
  });

  it("con «Recordar» desmarcado no guarda los datos al confirmar", async () => {
    render(<Prueba />);
    escribir();

    enviar();

    await waitFor(() => expect(navegacion.push).toHaveBeenCalledWith("/pedido/pedido-1?nuevo=1"));
    expect(guardados()).toBeNull();
  });

  it("con «Recordar» marcado guarda los datos al confirmar", async () => {
    render(<Prueba />);
    escribir();
    fireEvent.click(recordar());

    enviar();

    await waitFor(() => expect(navegacion.push).toHaveBeenCalled());
    expect(guardados()).toEqual(GUARDADOS);
    expect(useCarrito.getState().lineas).toEqual([]);
  });

  it("desmarcar «Recordar» olvida los datos que estaban guardados", async () => {
    localStorage.setItem("anaya-datos", JSON.stringify(GUARDADOS));
    render(<Prueba />);
    fireEvent.click(recordar());

    enviar();

    await waitFor(() => expect(navegacion.push).toHaveBeenCalled());
    expect(guardados()).toBeNull();
  });

  it("si el pedido no se confirma, no guarda nada ni vacía la bolsa", async () => {
    servidor.confirmarPedido.mockResolvedValue({ ok: false, campo: "ciudad", mensaje: "Escribe tu ciudad o municipio." });
    render(<Prueba />);
    escribir();
    fireEvent.click(recordar());

    enviar();

    await waitFor(() =>
      expect(screen.getByLabelText("Ciudad")).toHaveAccessibleDescription(/Escribe tu ciudad o municipio/)
    );
    expect(guardados()).toBeNull();
    expect(navegacion.push).not.toHaveBeenCalled();
    expect(useCarrito.getState().lineas).toHaveLength(1);
  });

  it("el error de un campo se va en cuanto la clienta lo corrige", async () => {
    servidor.confirmarPedido.mockResolvedValue({ ok: false, campo: "whatsapp", mensaje: "Revisa el número de WhatsApp." });
    render(<Prueba />);
    escribir();
    enviar();
    const whatsapp = screen.getByLabelText("WhatsApp");
    await waitFor(() => expect(whatsapp).toHaveAccessibleDescription(/Revisa el número de WhatsApp/));
    expect(whatsapp).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(whatsapp, { target: { value: "300 123 45678" } });

    expect(whatsapp).not.toHaveAccessibleDescription(/Revisa el número/);
    expect(whatsapp).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Revisa el número de WhatsApp.")).not.toBeInTheDocument();
  });

  it("corregir otro campo no borra el error del que lo tiene", async () => {
    servidor.confirmarPedido.mockResolvedValue({ ok: false, campo: "whatsapp", mensaje: "Revisa el número de WhatsApp." });
    render(<Prueba />);
    escribir();
    enviar();
    await waitFor(() => expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("aria-invalid", "true"));

    fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Cali" } });

    expect(screen.getByLabelText("WhatsApp")).toHaveAccessibleDescription(/Revisa el número de WhatsApp/);
  });

  it("si la conexión falla, lo dice y la bolsa sigue intacta", async () => {
    servidor.confirmarPedido.mockRejectedValue(new Error("Failed to fetch"));
    render(<Prueba />);
    escribir();

    enviar();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tu bolsa sigue guardada"));
    expect(useCarrito.getState().lineas).toHaveLength(1);
  });

  it("la nota se despliega con «Agregar una nota (opcional)»", () => {
    render(<Prueba />);
    const abrir = screen.getByRole("button", { name: "Agregar una nota (opcional)" });
    expect(abrir).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: /Nota/ })).not.toBeInTheDocument();

    fireEvent.click(abrir);

    expect(screen.getByRole("textbox", { name: /Nota/ })).toHaveFocus();
    expect(abrir).toHaveAttribute("aria-expanded", "true");
  });

  it("Enter en un campo pasa al siguiente en vez de confirmar", () => {
    render(<Prueba />);
    escribir();

    fireEvent.keyDown(screen.getByLabelText("Nombre"), { key: "Enter" });
    expect(screen.getByLabelText("WhatsApp")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("WhatsApp"), { key: "Enter" });
    expect(screen.getByLabelText("Ciudad")).toHaveFocus();
    expect(servidor.confirmarPedido).not.toHaveBeenCalled();
  });

  it("lleva el aviso de privacidad con el enlace a la política", () => {
    render(<Prueba />);

    expect(
      screen.getByText(/Al confirmar aceptas que usemos tus datos solo para gestionar tu pedido/)
    ).toBeInTheDocument();
    const politica = screen.getByRole("link", { name: "Política de privacidad" });
    expect(politica).toHaveAttribute("href", "/privacidad");
    expect(politica).toHaveAttribute("target", "_blank");
    expect(politica).toHaveAttribute("rel", "noopener");
    expect(
      screen.getByText("Aquí no pagas nada todavía: después de confirmar te mostramos cómo pagar.")
    ).toBeInTheDocument();
  });
});
