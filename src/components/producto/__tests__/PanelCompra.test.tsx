import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { usarCarrito } from "@/lib/cart";
import type { Producto } from "@/lib/types";

const labial: Producto = {
  id: "p1",
  referencia: "REF-101",
  nombre: "Labial Rojo Pasión",
  descripcion: null,
  categoriaId: null,
  categoriaNombre: null,
  imagenPrincipal: null,
  galeria: [],
  stock: 4,
  activo: true,
  escalones: [
    { minCantidad: 1, precioUnitario: 10000 },
    { minCantidad: 3, precioUnitario: 9000 },
    { minCantidad: 6, precioUnitario: 8000 },
  ],
  numTonos: 0,
  tonos: [],
};

const conTonos: Producto = {
  ...labial,
  stock: 10,
  numTonos: 2,
  tonos: [
    { id: "t1", nombre: "Cereza", colorHex: "#C81E4A", orden: 0 },
    { id: "t2", nombre: "Vino", colorHex: "#6E1E38", orden: 1 },
  ],
};

describe("PanelCompra", () => {
  beforeEach(() => {
    usarCarrito.getState().vaciar();
  });

  it("muestra el subtotal del escalón que aplica", () => {
    render(<PanelCompra producto={labial} />);
    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$10.000");

    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$27.000");
  });

  it("sugiere el siguiente escalón con el ahorro real", () => {
    render(<PanelCompra producto={labial} />);
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    expect(screen.getByText(/suma 1 más/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3\.000/)).toBeInTheDocument();
  });

  it("nunca permite pasar del stock disponible", () => {
    render(<PanelCompra producto={labial} />);
    const aumentar = screen.getByRole("button", { name: /aumentar/i });

    for (let i = 0; i < 10; i++) fireEvent.click(aumentar);

    expect(screen.getByLabelText("Cantidad")).toHaveTextContent("4");
    expect(aumentar).toBeDisabled();
  });

  it("agrega la cantidad elegida al carrito", () => {
    render(<PanelCompra producto={labial} />);
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    fireEvent.click(screen.getByRole("button", { name: /agregar/i }));

    expect(usarCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 2 },
    ]);
  });

  it("bloquea la compra cuando el producto está agotado", () => {
    render(<PanelCompra producto={{ ...labial, stock: 0 }} />);
    expect(screen.getByText(/agotado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
  });

  it("no sugiere un escalón que el stock no alcanza", () => {
    render(<PanelCompra producto={labial} />);
    const aumentar = screen.getByRole("button", { name: /aumentar/i });
    fireEvent.click(aumentar);
    fireEvent.click(aumentar);
    fireEvent.click(aumentar);

    expect(screen.queryByText(/suma .* más/i)).not.toBeInTheDocument();
  });
});

describe("PanelCompra con tonos", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("no deja agregar hasta que se elige un tono", () => {
    render(<PanelCompra producto={conTonos} />);

    const boton = screen.getByRole("button", { name: /elige un tono/i });
    expect(boton).toBeDisabled();
    expect(usarCarrito.getState().lineas).toEqual([]);
  });

  it("habilita la compra al elegir un tono y lo guarda en el carrito", () => {
    render(<PanelCompra producto={conTonos} />);

    fireEvent.click(screen.getByRole("radio", { name: "Cereza" }));
    expect(screen.getByText(/elegiste: cereza/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar/i }));

    expect(usarCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: "t1", tonoNombre: "Cereza", cantidad: 1 },
    ]);
  });

  it("marca cuál es el tono elegido para lectores de pantalla", () => {
    render(<PanelCompra producto={conTonos} />);
    fireEvent.click(screen.getByRole("radio", { name: "Vino" }));

    expect(screen.getByRole("radio", { name: "Vino" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Cereza" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("cuenta los tonos ya en la bolsa para elegir el escalón", () => {
    // Ya hay 2 de un tono: agregar 1 de OTRO tono llega a 3 unidades del
    // producto, así que esa unidad ya se cobra al precio del escalón de 3.
    usarCarrito.getState().agregar("p1", 2, { id: "t1", nombre: "Cereza" });

    render(<PanelCompra producto={conTonos} />);
    fireEvent.click(screen.getByRole("radio", { name: "Vino" }));

    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$9.000");
  });

  it("pinta lo que ya está en la bolsa al precio del escalón alcanzado", () => {
    // 2 de Cereza + 1 de Vino = 3 unidades → las tres a $9.000, así que la
    // línea de Cereza vale $18.000 y no $20.000.
    usarCarrito.getState().agregar("p1", 2, { id: "t1", nombre: "Cereza" });
    usarCarrito.getState().agregar("p1", 1, { id: "t2", nombre: "Vino" });

    render(<PanelCompra producto={conTonos} />);

    expect(screen.getByText("$18.000")).toBeInTheDocument();
  });

  it("descuenta del disponible lo que ya está en la bolsa, sumando tonos", () => {
    // stock 10; metemos 8 entre dos tonos, deben quedar 2
    usarCarrito.getState().agregar("p1", 5, { id: "t1", nombre: "Cereza" });
    usarCarrito.getState().agregar("p1", 3, { id: "t2", nombre: "Vino" });

    render(<PanelCompra producto={conTonos} />);
    fireEvent.click(screen.getByRole("radio", { name: "Cereza" }));

    const aumentar = screen.getByRole("button", { name: /aumentar/i });
    for (let i = 0; i < 8; i++) fireEvent.click(aumentar);

    expect(screen.getByLabelText("Cantidad")).toHaveTextContent("2");
  });
});
