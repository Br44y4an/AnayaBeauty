import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { usarCarrito } from "@/lib/cart";
import type { Producto } from "@/lib/types";

const base: Producto = {
  id: "p1",
  referencia: "REF-101",
  nombre: "Labial Rojo Pasión",
  descripcion: null,
  categoriaId: null,
  categoriaNombre: null,
  imagenPrincipal: null,
  galeria: [],
  stock: 10,
  activo: true,
  escalones: [
    { minCantidad: 1, precioUnitario: 10000 },
    { minCantidad: 3, precioUnitario: 9000 },
  ],
  numTonos: 0,
  tonos: [],
};

/** Un producto con paleta. La tarjeta solo sabe CUÁNTOS tonos hay. */
const conTonos: Producto = { ...base, id: "p2", referencia: "REF-202", numTonos: 24 };

describe("TarjetaProducto", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("NO pinta la paleta de tonos en la grilla", () => {
    // La queja original: "estoy obligada a ver los tonos de productos que
    // no quiero". Con 24 tonos por tarjeta y 24 tarjetas por pantalla,
    // el catálogo era un muro de círculos de colores.
    render(<TarjetaProducto producto={conTonos} />);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("ofrece abrir la paleta en vez de mostrarla", () => {
    render(<TarjetaProducto producto={conTonos} />);
    expect(screen.getByRole("button", { name: /elegir tono/i })).toBeInTheDocument();
  });

  it("deja sumar desde la tarjeta cuando el producto no tiene tonos", () => {
    // Sin tonos no hay nada que decidir: durante un live, entrar al
    // detalle por cada producto es fricción pura.
    render(<TarjetaProducto producto={base} />);

    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    expect(usarCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 1 },
    ]);
  });

  it("cambia a sumar y restar una vez hay algo en la bolsa", () => {
    render(<TarjetaProducto producto={base} />);
    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    fireEvent.click(screen.getByRole("button", { name: /agregar uno de/i }));
    expect(usarCarrito.getState().lineas[0].cantidad).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: /quitar uno de/i }));
    expect(usarCarrito.getState().lineas[0].cantidad).toBe(1);
  });

  it("muestra el precio que se está cobrando ahora, no el más barato del combo", () => {
    // Pintar el precio del combo confundía: no coincidía con el cobro.
    render(<TarjetaProducto producto={base} />);
    expect(screen.getByText(/\$10\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/\$9\.000/)).not.toBeInTheDocument();
  });

  it("baja el precio en pantalla al alcanzar el escalón", () => {
    usarCarrito.getState().agregar("p1", 3);
    render(<TarjetaProducto producto={base} />);

    expect(screen.getByText(/\$9\.000/)).toBeInTheDocument();
  });

  it("no deja pasar del stock disponible", () => {
    const casiAgotado = { ...base, id: "p3", stock: 1 };
    render(<TarjetaProducto producto={casiAgotado} />);

    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));
    expect(screen.getByRole("button", { name: /agregar uno de/i })).toBeDisabled();
  });

  it("marca el producto agotado y no ofrece agregarlo", () => {
    const agotado = { ...base, id: "p4", stock: 0 };
    render(<TarjetaProducto producto={agotado} />);

    expect(screen.getByText(/agotado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^agregar$/i })).not.toBeInTheDocument();
  });

  it("avisa cuando un producto todavía no tiene precio, sin ofrecerlo", () => {
    const sinPrecio = { ...base, id: "p5", escalones: [] };
    render(<TarjetaProducto producto={sinPrecio} />);

    expect(screen.getByText(/precio por confirmar/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^agregar$/i })).not.toBeInTheDocument();
  });

  it("escapa la referencia en el enlace al detalle", () => {
    // Hay referencias con "/" (ACRYLIC80/150): sin escapar, la ruta se
    // parte en dos y el producto da 404 desde el catálogo.
    const conBarra = { ...base, id: "p6", referencia: "ACRYLIC80/150" };
    render(<TarjetaProducto producto={conBarra} />);

    expect(screen.getByRole("link", { name: conBarra.nombre })).toHaveAttribute(
      "href",
      "/producto/ACRYLIC80%2F150"
    );
  });

  it("solo cuenta lo suyo: lo de otro producto no aparece en esta tarjeta", () => {
    usarCarrito.getState().agregar("otro-producto", 5);
    render(<TarjetaProducto producto={base} />);

    expect(screen.queryByText(/en tu bolsa/i)).not.toBeInTheDocument();
  });

  it("muestra cuántas lleva de este producto, sumando sus tonos", () => {
    usarCarrito.getState().agregar("p2", 2, { id: "t1", nombre: "Rubí" });
    usarCarrito.getState().agregar("p2", 1, { id: "t2", nombre: "Vino" });

    render(<TarjetaProducto producto={conTonos} />);

    expect(screen.getByText(/3 en tu bolsa/i)).toBeInTheDocument();
    // Con algo ya elegido, el botón invita a corregir, no a empezar.
    expect(screen.getByRole("button", { name: /cambiar/i })).toBeInTheDocument();
  });
});
