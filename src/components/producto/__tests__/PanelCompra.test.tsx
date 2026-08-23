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
    // 3 unidades entran al escalón de $9.000
    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$27.000");
  });

  it("sugiere el siguiente escalón con el ahorro real", () => {
    render(<PanelCompra producto={labial} />);
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i })); // 2 unidades
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

    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 2 }]);
  });

  it("bloquea la compra cuando el producto está agotado", () => {
    render(<PanelCompra producto={{ ...labial, stock: 0 }} />);
    expect(screen.getByText(/agotado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
  });

  it("no sugiere un escalón que el stock no alcanza", () => {
    // Stock 4: el escalón de 6 unidades es inalcanzable, no debe ofrecerse
    render(<PanelCompra producto={labial} />);
    const aumentar = screen.getByRole("button", { name: /aumentar/i });
    fireEvent.click(aumentar);
    fireEvent.click(aumentar);
    fireEvent.click(aumentar); // 4 unidades

    expect(screen.queryByText(/suma .* más/i)).not.toBeInTheDocument();
  });
});
