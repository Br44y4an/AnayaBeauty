// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PanelCompra } from "@/components/producto/PanelCompra";
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
  imagenPrincipal: null,
  galeria: [],
  stock: 50,
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

const unSoloTono: Producto = { ...brillo, numVariantes: 1, variantes: [brillo.variantes![0]] };
const lipGloss: Producto = { ...brillo, id: "p2", nombre: "Lip gloss", numVariantes: 0, variantes: [] };

beforeAll(() => {
  // jsdom no implementa el desplazamiento.
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => useCarrito.getState().vaciar());
afterEach(() => act(() => cerrarAviso()));

describe("PanelCompra", () => {
  it("sin selección el botón dice «Elige un tono» y al tocarlo pide elegir y enfoca la lista", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    const boton = screen.getByRole("button", { name: "Elige un tono" });
    expect(boton).toBeEnabled();

    fireEvent.click(boton);

    expect(screen.getByText("Elige al menos un tono")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Elige el tono" })).toHaveFocus();
    expect(useCarrito.getState().lineas).toEqual([]);
  });

  it("el aviso de elegir se va en cuanto elige un tono", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    fireEvent.click(screen.getByRole("button", { name: "Elige un tono" }));

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 2" }));

    expect(screen.queryByText("Elige al menos un tono")).not.toBeInTheDocument();
  });

  it("con 2 unidades del tono A el botón dice «Agregar 2 · $16.000»", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    const sumar = screen.getByRole("button", { name: "Agregar uno de Tono 1" });

    fireEvent.click(sumar);
    fireEvent.click(sumar);

    expect(screen.getByRole("button", { name: "Agregar 2 · $16.000" })).toBeInTheDocument();
  });

  it("lo que ya está en la bolsa cuenta para el precio de lo nuevo", () => {
    useCarrito.getState().agregar("p1", 2, { id: "a", nombre: "Tono 1" });
    render(<PanelCompra producto={brillo} variante="pagina" />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 2" }));

    expect(screen.getByRole("button", { name: "Agregar 1 · $7.500" })).toBeInTheDocument();
    expect(screen.getByText("2 en tu bolsa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver bolsa" })).toHaveAttribute("href", "/carrito");
  });

  it("un producto sin variantes empieza en 1 y dice «Agregar 1 · $8.000»", () => {
    render(<PanelCompra producto={lipGloss} variante="pagina" />);

    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cantidad de Lip gloss" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Agregar 1 · $8.000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar uno de Lip gloss" })).toBeDisabled();
  });

  it("con 2 o más variantes avisa que se mezclan para el precio", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    expect(screen.getByText("Puedes mezclar tonos: cuentan juntos para el precio.")).toBeInTheDocument();
  });

  it("con una sola variante no habla de mezclar, pero muestra su fila sin elegirla sola", () => {
    render(<PanelCompra producto={unSoloTono} variante="pagina" />);

    expect(screen.queryByText(/Puedes mezclar/)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cantidad de Tono 1" })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "Elige un tono" })).toBeInTheDocument();
  });

  it("al agregar deja las líneas, avisa y vuelve a «Elige un tono» en la página", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 3" }));

    fireEvent.click(screen.getByRole("button", { name: "Agregar 2 · $16.000" }));

    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: "a", tonoNombre: "Tono 1", cantidad: 1 },
      { productoId: "p1", tonoId: "c", tonoNombre: "Tono 3", cantidad: 1 },
    ]);
    expect(avisoActual()?.detalle).toBe("2 × Brillo labial Oil Glazed Shine");
    expect(screen.getByRole("button", { name: "Elige un tono" })).toBeInTheDocument();
  });

  it("el pie con el botón principal va marcado con data-pie-fijo", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    expect(screen.getByRole("button", { name: "Elige un tono" }).closest("[data-pie-fijo]")).not.toBeNull();
  });

  it("agotado: lo dice, no ofrece agregar y lleva a WhatsApp", () => {
    render(<PanelCompra producto={{ ...brillo, stock: 0 }} variante="pagina" whatsapp="573001234567" />);

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Agregar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preguntar por WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/573001234567?text=")
    );
  });

  it("sin precio dice «Precio por confirmar» y ofrece preguntar", () => {
    render(<PanelCompra producto={{ ...lipGloss, escalones: [] }} variante="pagina" />);

    expect(screen.getByText("Precio por confirmar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Agregar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preguntar el precio" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/")
    );
  });

  it("con toda la existencia en la bolsa lo explica y lleva a la bolsa", () => {
    useCarrito.getState().agregar("p2", 4);
    render(<PanelCompra producto={{ ...lipGloss, stock: 4 }} variante="pagina" />);

    expect(screen.getByText("Ya tienes en tu bolsa todas las unidades disponibles.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Agregar/ })).not.toBeInTheDocument();
  });

  it("si todas las variantes están agotadas se trata como agotado", () => {
    const sinTonos = { ...brillo, variantes: brillo.variantes!.map((v) => ({ ...v, agotado: true })) };
    render(<PanelCompra producto={sinTonos} variante="pagina" />);

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elige un tono" })).not.toBeInTheDocument();
  });

  it("con algo elegido dice cuánto falta para el escalón siguiente", () => {
    render(<PanelCompra producto={brillo} variante="pagina" />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 1" }));

    expect(screen.getByText("Con 2 más pagas $7.500 c/u.")).toBeInTheDocument();
  });

  it("habla de colores o paletas según la etiqueta del producto", () => {
    render(<PanelCompra producto={{ ...brillo, etiquetaVariante: "Paleta" }} variante="pagina" />);

    expect(screen.getByText("Puedes mezclar paletas: cuentan juntas para el precio.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elige una paleta" }));
    expect(screen.getByText("Elige al menos una paleta")).toBeInTheDocument();
  });

  it("con pocas unidades avisa cuántas quedan", () => {
    render(<PanelCompra producto={{ ...lipGloss, stock: 3 }} variante="pagina" />);
    expect(screen.getByText("Quedan 3")).toBeInTheDocument();
  });

  it("pinta lo que recibe como hijos antes del pie", () => {
    render(
      <PanelCompra producto={brillo} variante="pagina">
        <p>Descripción del producto</p>
      </PanelCompra>
    );
    const descripcion = screen.getByText("Descripción del producto");
    const pie = screen.getByRole("button", { name: "Elige un tono" }).closest("[data-pie-fijo]")!;
    expect(descripcion.compareDocumentPosition(pie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
