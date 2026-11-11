// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { act, render, renderHook } from "@testing-library/react";
import { useCompraProducto, useLineasEnBolsa } from "@/hooks/useCompraProducto";
import { useCarrito } from "@/lib/cart";
import { avisoActual, cerrarAviso } from "@/lib/avisos";
import type { Producto } from "@/lib/types";

const brillo: Producto = {
  id: "p1",
  referencia: "GLS735",
  nombre: "Brillo labial Oil Glazed Shine",
  descripcion: null,
  categoriaId: "cat-1",
  categoriaNombre: "Lip gloss",
  categoriaSlug: "lip-gloss",
  imagenPrincipal: "https://ejemplo.test/gls735.jpeg",
  galeria: [],
  stock: 20,
  activo: true,
  destacado: false,
  escalones: [
    { minCantidad: 1, precioUnitario: 8000 },
    { minCantidad: 3, precioUnitario: 7500 },
    { minCantidad: 6, precioUnitario: 6500 },
  ],
  etiquetaVariante: "Tono",
  numVariantes: 3,
  variantes: [
    { id: "a", nombre: "Tono 1", colorHex: "#d3656e", orden: 0, agotado: false },
    { id: "b", nombre: "Tono 2", colorHex: "#f63037", orden: 1, agotado: false },
    { id: "c", nombre: "Tono 3", colorHex: "#fd909f", orden: 2, agotado: false },
  ],
};

const lipGloss: Producto = {
  ...brillo,
  id: "p2",
  referencia: "LGC-372",
  nombre: "Lip gloss",
  numVariantes: 0,
  variantes: [],
};

beforeEach(() => useCarrito.getState().vaciar());
afterEach(() => {
  act(() => cerrarAviso());
  vi.restoreAllMocks();
});

describe("useCompraProducto", () => {
  it("cuenta lo que ya está en la bolsa para el escalón de lo que se elige", () => {
    useCarrito.getState().agregar("p1", 1, { id: "c", nombre: "Tono 3" });
    const { result } = renderHook(() => useCompraProducto(brillo));

    act(() => result.current.cambiar("a", 1));
    act(() => result.current.cambiar("b", 1));

    expect(result.current.seleccion).toEqual({ a: 1, b: 1 });
    expect(result.current.resumen.unidadesTotales).toBe(3);
    expect(result.current.resumen.precioUnitario).toBe(7500);
    expect(result.current.resumen.subtotalNuevas).toBe(15000);
  });

  it("agregar deja una línea por variante, vibra, avisa y limpia la selección", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    useCarrito.getState().agregar("p1", 1, { id: "c", nombre: "Tono 3" });
    const { result } = renderHook(() => useCompraProducto(brillo));
    act(() => result.current.cambiar("a", 1));
    act(() => result.current.cambiar("b", 1));

    let agregado = false;
    act(() => {
      agregado = result.current.agregar();
    });

    expect(agregado).toBe(true);
    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: "c", tonoNombre: "Tono 3", cantidad: 1 },
      { productoId: "p1", tonoId: "a", tonoNombre: "Tono 1", cantidad: 1 },
      { productoId: "p1", tonoId: "b", tonoNombre: "Tono 2", cantidad: 1 },
    ]);
    expect(vibrate).toHaveBeenCalledWith(15);
    expect(avisoActual()).toMatchObject({
      titulo: "Agregado a tu bolsa",
      detalle: "2 × Brillo labial Oil Glazed Shine",
      imagen: "https://ejemplo.test/gls735.jpeg",
      accion: { etiqueta: "Ver bolsa", href: "/carrito" },
    });
    expect(result.current.seleccion).toEqual({});
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("con la selección vacía no agrega nada, no avisa y devuelve false", () => {
    const { result } = renderHook(() => useCompraProducto(brillo));

    let agregado = true;
    act(() => {
      agregado = result.current.agregar();
    });

    expect(agregado).toBe(false);
    expect(useCarrito.getState().lineas).toEqual([]);
    expect(avisoActual()).toBeNull();
  });

  it("sin variantes empieza en 1 con la clave «unica» y agrega sin tono", () => {
    const { result } = renderHook(() => useCompraProducto(lipGloss));
    expect(result.current.seleccion).toEqual({ unica: 1 });
    expect(result.current.resumen.subtotalNuevas).toBe(8000);

    act(() => result.current.cambiar("unica", 3));
    act(() => {
      result.current.agregar();
    });

    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p2", tonoId: null, tonoNombre: null, cantidad: 3 },
    ]);
    expect(avisoActual()?.detalle).toBe("3 × Lip gloss");
    expect(result.current.seleccion).toEqual({ unica: 1 });
  });

  it("no deja elegir más de lo que queda ni variantes agotadas o ajenas", () => {
    const corto: Producto = {
      ...brillo,
      stock: 3,
      variantes: [...brillo.variantes!, { id: "d", nombre: "Tono 4", colorHex: "#cc189c", orden: 3, agotado: true }],
    };
    useCarrito.getState().agregar("p1", 1, { id: "c", nombre: "Tono 3" });
    const { result } = renderHook(() => useCompraProducto(corto));

    act(() => result.current.cambiar("a", 5));
    act(() => result.current.cambiar("b", 1));
    act(() => result.current.cambiar("d", 1));
    act(() => result.current.cambiar("otra", 1));

    expect(result.current.seleccion).toEqual({ a: 2 });
    expect(result.current.resumen.maxNuevas).toBe(2);

    act(() => result.current.cambiar("a", 0));
    expect(result.current.seleccion).toEqual({});
  });

  it("en el HTML del servidor la bolsa sale vacía, como la ve el servidor", () => {
    useCarrito.getState().agregar("p1", 2, { id: "a", nombre: "Tono 1" });
    function EnBolsa() {
      return <p>{useLineasEnBolsa("p1").length}</p>;
    }

    expect(renderToString(<EnBolsa />)).toBe("<p>0</p>");
    expect(render(<EnBolsa />).container.textContent).toBe("1");
  });

  it("un producto agotado no agrega aunque haya selección", () => {
    const agotado: Producto = { ...lipGloss, stock: 0 };
    const { result } = renderHook(() => useCompraProducto(agotado));

    let agregado = true;
    act(() => {
      agregado = result.current.agregar();
    });

    expect(agregado).toBe(false);
    expect(result.current.resumen.bloqueo).toBe("agotado");
    expect(useCarrito.getState().lineas).toEqual([]);
  });
});
