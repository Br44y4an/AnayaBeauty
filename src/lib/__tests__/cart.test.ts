import { describe, it, expect, beforeEach } from "vitest";
import { usarCarrito, totalUnidades } from "@/lib/cart";

describe("carrito", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("agrega un producto nuevo", () => {
    usarCarrito.getState().agregar("p1", 2);
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 2 }]);
  });

  it("suma la cantidad si el producto ya estaba", () => {
    usarCarrito.getState().agregar("p1", 2);
    usarCarrito.getState().agregar("p1", 3);
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 5 }]);
  });

  it("mantiene productos distintos como líneas separadas", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().agregar("p2", 4);
    expect(usarCarrito.getState().lineas).toHaveLength(2);
  });

  it("establece una cantidad exacta", () => {
    usarCarrito.getState().agregar("p1", 5);
    usarCarrito.getState().establecer("p1", 2);
    expect(usarCarrito.getState().lineas[0].cantidad).toBe(2);
  });

  it("elimina la línea si la cantidad baja a cero", () => {
    usarCarrito.getState().agregar("p1", 3);
    usarCarrito.getState().establecer("p1", 0);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });

  it("quita un producto", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().agregar("p2", 1);
    usarCarrito.getState().quitar("p1");
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p2", cantidad: 1 }]);
  });

  it("cuenta el total de unidades", () => {
    usarCarrito.getState().agregar("p1", 3);
    usarCarrito.getState().agregar("p2", 4);
    expect(totalUnidades(usarCarrito.getState())).toBe(7);
  });

  it("guarda el código que llega por el link mágico", () => {
    usarCarrito.getState().guardarCodigo("4821");
    expect(usarCarrito.getState().codigo).toBe("4821");
  });

  it("vaciar borra las líneas y el código", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().guardarCodigo("4821");
    usarCarrito.getState().vaciar();
    expect(usarCarrito.getState().lineas).toEqual([]);
    expect(usarCarrito.getState().codigo).toBeNull();
  });

  it("ignora cantidades inválidas", () => {
    usarCarrito.getState().agregar("p1", 0);
    usarCarrito.getState().agregar("p2", -3);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });
});
