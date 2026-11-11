// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { useCarrito } from "@/lib/cart";
import type { Producto } from "@/lib/types";

function producto(cambios: Partial<Producto> = {}): Producto {
  return {
    id: "p1",
    referencia: "AC80/150",
    nombre: "Brillo labial Oil Glazed Shine",
    descripcion: null,
    categoriaId: "c1",
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
    numVariantes: 0,
    variantes: null,
    ...cambios,
  };
}

describe("TarjetaProducto", () => {
  beforeEach(() => useCarrito.getState().vaciar());

  it("foto y nombre van en un mismo enlace a la ficha, con la referencia codificada", () => {
    render(<TarjetaProducto producto={producto({ imagenPrincipal: "/foto.jpg" })} />);

    const enlace = screen.getByText("Brillo labial Oil Glazed Shine").closest("a");
    expect(enlace).toHaveAttribute("href", "/producto/AC80%2F150");
    expect(enlace?.querySelector("img")).not.toBeNull();
  });

  it("muestra «Ref.», el precio de una unidad con «c/u» y el escalón siguiente", () => {
    render(<TarjetaProducto producto={producto()} />);

    expect(screen.getByText("Ref. AC80/150")).toBeInTheDocument();
    expect(screen.getByText("$8.000")).toBeInTheDocument();
    expect(screen.getByText("c/u")).toBeInTheDocument();
    expect(screen.getByText("3 o más: $7.500 c/u")).toBeInTheDocument();
  });

  it("con un solo escalón no habla de precio por cantidad", () => {
    render(<TarjetaProducto producto={producto({ escalones: [{ minCantidad: 1, precioUnitario: 80000 }] })} />);

    expect(screen.getByText("$80.000")).toBeInTheDocument();
    expect(screen.queryByText(/o más/)).not.toBeInTheDocument();
  });

  it("con 6 tonos la acción es el enlace «Elegir tono · 6» a la ficha", () => {
    render(<TarjetaProducto producto={producto({ numVariantes: 6 })} />);

    expect(screen.getByRole("link", { name: "Elegir tono · 6" })).toHaveAttribute(
      "href",
      "/producto/AC80%2F150"
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("la acción usa la etiqueta del producto: «Elegir color · 4»", () => {
    render(<TarjetaProducto producto={producto({ numVariantes: 4, etiquetaVariante: "Color" })} />);

    expect(screen.getByRole("link", { name: "Elegir color · 4" })).toBeInTheDocument();
  });

  it("agotado: etiqueta «Agotado» y nada para agregar ni elegir", () => {
    render(<TarjetaProducto producto={producto({ stock: 0, numVariantes: 6 })} />);

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /elegir/i })).not.toBeInTheDocument();
  });

  it("sin escalones: «Precio por confirmar», sin cifras y sin botón", () => {
    render(<TarjetaProducto producto={producto({ escalones: [] })} />);

    expect(screen.getByText("Precio por confirmar")).toBeInTheDocument();
    expect(screen.queryByText(/\$|NaN|undefined/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con stock 3 avisa «Quedan 3»; con stock de sobra no", () => {
    const { rerender } = render(<TarjetaProducto producto={producto({ stock: 3 })} />);
    expect(screen.getByText("Quedan 3")).toBeInTheDocument();

    rerender(<TarjetaProducto producto={producto({ stock: 40 })} />);
    expect(screen.queryByText(/quedan/i)).not.toBeInTheDocument();
  });

  it("no lleva la insignia «Combo»", () => {
    render(<TarjetaProducto producto={producto()} />);
    expect(screen.queryByText(/combo/i)).not.toBeInTheDocument();
  });

  it("dice cuántas unidades de este producto hay en la bolsa, sumando sus tonos", () => {
    useCarrito.getState().agregar("p1", 2, { id: "t1", nombre: "Tono 1" });
    useCarrito.getState().agregar("p1", 1, { id: "t2", nombre: "Tono 2" });
    useCarrito.getState().agregar("otro", 5);

    render(<TarjetaProducto producto={producto({ numVariantes: 6 })} />);

    expect(screen.getByText("3 en tu bolsa")).toBeInTheDocument();
  });

  it("sin foto, la tesela lo dice en vez de quedar vacía", () => {
    render(<TarjetaProducto producto={producto()} />);
    expect(screen.getByText("Sin foto")).toBeInTheDocument();
  });

  it("compacta (riel de destacados): un solo enlace a la ficha con nombre y precio, sin acción", () => {
    render(<TarjetaProducto producto={producto({ numVariantes: 6 })} compacta />);

    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAttribute("href", "/producto/AC80%2F150");
    expect(enlaces[0]).toHaveTextContent("Brillo labial Oil Glazed Shine");
    expect(enlaces[0]).toHaveTextContent("$8.000");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
