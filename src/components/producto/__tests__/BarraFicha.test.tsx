// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BarraFicha } from "@/components/producto/BarraFicha";
import { avisoActual, cerrarAviso } from "@/lib/avisos";

const nav = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: nav.back, push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

function definir(objeto: object, clave: string, valor: unknown) {
  Object.defineProperty(objeto, clave, { value: valor, configurable: true });
}

beforeEach(() => {
  nav.back.mockReset();
  window.history.replaceState(null, "", "/producto/AC80%2F150");
});

afterEach(() => {
  act(() => cerrarAviso());
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "referrer");
});

describe("BarraFicha", () => {
  it("sin navigator.share copia el enlace de la ficha y lo avisa", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    definir(navigator, "clipboard", { writeText });
    render(<BarraFicha variante="modal" nombre="Acrílico" referencia="AC80/150" />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartir" })));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/producto/AC80%2F150");
    expect(avisoActual()).toMatchObject({ titulo: "Enlace copiado", detalle: "Acrílico" });
  });

  it("si la clienta cancela el menú de compartir no copia nada", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("cancelado"), { name: "AbortError" }));
    const writeText = vi.fn();
    definir(navigator, "share", share);
    definir(navigator, "clipboard", { writeText });
    render(<BarraFicha variante="pagina" nombre="Acrílico" referencia="AC80/150" />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartir" })));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "http://localhost:3000/producto/AC80%2F150" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(avisoActual()).toBeNull();
  });

  it("«Volver al catálogo» vuelve atrás si llegó desde la tienda", () => {
    definir(document, "referrer", "http://localhost:3000/?categoria=labios");
    window.history.pushState(null, "", "/producto/AC80%2F150");
    render(<BarraFicha variante="pagina" nombre="Acrílico" referencia="AC80/150" />);

    const enlace = screen.getByRole("link", { name: "Volver al catálogo" });
    const evento = fireEvent.click(enlace);

    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(evento).toBe(false);
  });

  it("«Volver al catálogo» lleva al inicio si llegó de afuera", () => {
    definir(document, "referrer", "https://wa.me/");
    render(<BarraFicha variante="pagina" nombre="Acrílico" referencia="AC80/150" />);

    const enlace = screen.getByRole("link", { name: "Volver al catálogo" });
    expect(enlace).toHaveAttribute("href", "/");
    fireEvent.click(enlace);
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("en la vista rápida no hay «Volver al catálogo»: la hoja se cierra con su botón", () => {
    render(<BarraFicha variante="modal" nombre="Acrílico" referencia="AC80/150" />);
    expect(screen.queryByRole("link", { name: "Volver al catálogo" })).not.toBeInTheDocument();
  });
});
