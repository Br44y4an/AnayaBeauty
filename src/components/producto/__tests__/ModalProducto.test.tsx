// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ModalProducto } from "@/components/producto/ModalProducto";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { ProductoNoDisponible } from "@/components/producto/ProductoNoDisponible";
import { useCarrito } from "@/lib/cart";
import { avisoActual, cerrarAviso } from "@/lib/avisos";
import type { Producto } from "@/lib/types";

const nav = vi.hoisted(() => ({ ruta: "/producto/GLS735", back: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.ruta,
  useRouter: () => ({ back: nav.back, push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const brillo: Producto = {
  id: "p1",
  referencia: "GLS735",
  nombre: "Brillo labial Oil Glazed Shine",
  descripcion: null,
  categoriaId: "cat-1",
  categoriaNombre: "Lip gloss",
  categoriaSlug: "lip-gloss",
  imagenPrincipal: null,
  galeria: [],
  stock: 50,
  activo: true,
  destacado: false,
  escalones: [
    { minCantidad: 1, precioUnitario: 8000 },
    { minCantidad: 3, precioUnitario: 7500 },
  ],
  etiquetaVariante: "Tono",
  numVariantes: 2,
  variantes: [
    { id: "a", nombre: "Tono 1", colorHex: "#d3656e", orden: 0, agotado: false },
    { id: "b", nombre: "Tono 2", colorHex: "#f63037", orden: 1, agotado: false },
  ],
};

const ficha = () => (
  <ModalProducto>
    <p>Brillo labial Oil Glazed Shine</p>
  </ModalProducto>
);

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.useFakeTimers();
  nav.ruta = "/producto/GLS735";
  nav.back.mockReset();
  window.history.replaceState(null, "", "/producto/GLS735");
  useCarrito.getState().vaciar();
});

afterEach(() => {
  act(() => cerrarAviso());
  vi.useRealTimers();
});

describe("ModalProducto", () => {
  it("en /producto/X es un diálogo modal", () => {
    render(ficha());
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Brillo labial Oil Glazed Shine")).toBeInTheDocument();
  });

  it("tocar Cerrar dos veces seguidas llama router.back una sola vez", () => {
    render(ficha());
    const cerrar = screen.getByRole("button", { name: "Cerrar" });

    fireEvent.click(cerrar);
    fireEvent.click(cerrar);
    act(() => vi.advanceTimersByTime(500));

    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it("Escape y Cerrar seguidos también hacen un solo back", () => {
    render(ficha());

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    act(() => vi.advanceTimersByTime(500));

    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it("si la URL ya no es la de un producto, cerrar no toca el historial", () => {
    render(ficha());
    window.history.replaceState(null, "", "/");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    act(() => vi.advanceTimersByTime(500));

    expect(nav.back).not.toHaveBeenCalled();
  });

  it("con usePathname = /carrito no pinta nada", () => {
    nav.ruta = "/carrito";
    const { container } = render(ficha());

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al agregar avisa y se cierra con un solo back aunque toquen Agregar dos veces", () => {
    render(
      <ModalProducto>
        <PanelCompra producto={brillo} variante="modal" />
      </ModalProducto>
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 2" }));
    const agregar = screen.getByRole("button", { name: "Agregar 1 · $8.000" });

    fireEvent.click(agregar);
    fireEvent.click(agregar);
    act(() => vi.advanceTimersByTime(500));

    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: "b", tonoNombre: "Tono 2", cantidad: 1 },
    ]);
    expect(avisoActual()?.titulo).toBe("Agregado a tu bolsa");
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it("al cerrar después de agregar el pie deja de empujar los avisos", () => {
    render(
      <ModalProducto>
        <PanelCompra producto={brillo} variante="modal" />
      </ModalProducto>
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 1" }));

    fireEvent.click(screen.getByRole("button", { name: "Agregar 1 · $8.000" }));

    expect(document.querySelector("[data-pie-fijo]")).toBeNull();
  });

  it("un producto que ya no está se explica dentro de la hoja y su Cerrar vuelve una sola vez", () => {
    render(
      <ModalProducto>
        <ProductoNoDisponible />
      </ModalProducto>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Este producto ya no está disponible" })).toBeInTheDocument();
    const cerrar = screen.getAllByRole("button", { name: "Cerrar" });

    cerrar.forEach((boton) => fireEvent.click(boton));
    act(() => vi.advanceTimersByTime(500));

    expect(nav.back).toHaveBeenCalledTimes(1);
  });
});
