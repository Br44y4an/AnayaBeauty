// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BotonBolsa } from "@/components/tienda/BotonBolsa";
import { useCarrito } from "@/lib/cart";

const linea = (productoId: string, cantidad: number, tonoId: string | null = null) => ({
  productoId,
  tonoId,
  tonoNombre: tonoId,
  cantidad,
});

describe("BotonBolsa", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useCarrito.setState({ lineas: [], claveEnvio: null }));
  });

  it("con 3 unidades enlaza a /carrito, se anuncia «Bolsa, 3 unidades» y muestra el 3", () => {
    act(() => useCarrito.setState({ lineas: [linea("p1", 2, "t1"), linea("p2", 1)] }));

    render(<BotonBolsa />);

    const enlace = screen.getByRole("link", { name: "Bolsa, 3 unidades" });
    expect(enlace).toHaveAttribute("href", "/carrito");
    expect(enlace).toHaveTextContent("3");
  });

  it("con 1 unidad usa el singular", () => {
    act(() => useCarrito.setState({ lineas: [linea("p1", 1)] }));

    render(<BotonBolsa />);

    expect(screen.getByRole("link", { name: "Bolsa, 1 unidad" })).toHaveTextContent("1");
  });

  it("con la bolsa vacía no muestra contador", () => {
    render(<BotonBolsa />);

    const enlace = screen.getByRole("link", { name: "Bolsa" });
    expect(enlace).not.toHaveTextContent(/\d/);
  });

  it("el contador cambia en cuanto se agrega a la bolsa", () => {
    render(<BotonBolsa />);

    act(() => useCarrito.getState().agregar("p1", 2));

    expect(screen.getByRole("link", { name: "Bolsa, 2 unidades" })).toHaveTextContent("2");
  });
});
