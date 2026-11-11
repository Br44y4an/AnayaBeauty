// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AgregarRapido } from "@/components/catalogo/AgregarRapido";
import { useCarrito } from "@/lib/cart";
import { mostrarAviso } from "@/lib/avisos";
import { vibrar } from "@/lib/dispositivo";
import type { Producto } from "@/lib/types";

vi.mock("@/lib/avisos", async (original) => {
  const real = await original<typeof import("@/lib/avisos")>();
  return { ...real, mostrarAviso: vi.fn() };
});
vi.mock("@/lib/dispositivo", () => ({ vibrar: vi.fn() }));

function producto(cambios: Partial<Producto> = {}): Producto {
  return {
    id: "p1",
    referencia: "WY-944",
    nombre: "Cepillo desenredante",
    descripcion: null,
    categoriaId: "c1",
    categoriaNombre: "Cepillos",
    categoriaSlug: "cepillos",
    imagenPrincipal: "/foto.jpg",
    galeria: [],
    stock: 50,
    activo: true,
    destacado: false,
    escalones: [
      { minCantidad: 1, precioUnitario: 8500 },
      { minCantidad: 3, precioUnitario: 8000 },
    ],
    etiquetaVariante: "Color",
    numVariantes: 0,
    variantes: null,
    ...cambios,
  };
}

const lineasDe = (productoId: string) =>
  useCarrito.getState().lineas.filter((l) => l.productoId === productoId);

describe("AgregarRapido", () => {
  beforeEach(() => {
    useCarrito.getState().vaciar();
    vi.clearAllMocks();
  });

  it("«Agregar» suma una unidad, vibra y avisa con «Ver bolsa»", () => {
    render(<AgregarRapido producto={producto()} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(lineasDe("p1")).toEqual([{ productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 1 }]);
    expect(vibrar).toHaveBeenCalledTimes(1);
    expect(mostrarAviso).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Agregado a tu bolsa",
        detalle: "1 × Cepillo desenredante",
        imagen: "/foto.jpg",
        accion: { etiqueta: "Ver bolsa", href: "/carrito" },
      })
    );
  });

  it("después de agregar se convierte en un stepper con 1", () => {
    render(<AgregarRapido producto={producto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    const stepper = screen.getByRole("group", { name: "Cantidad de Cepillo desenredante" });
    expect(stepper).toHaveTextContent("1");
    expect(screen.getByText("1 en tu bolsa")).toBeInTheDocument();
  });

  it("el + del stepper suma sin repetir el aviso", () => {
    render(<AgregarRapido producto={producto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Cepillo desenredante" }));

    expect(lineasDe("p1")[0].cantidad).toBe(2);
    expect(mostrarAviso).toHaveBeenCalledTimes(1);
  });

  it("bajar a 0 quita la línea y el aviso ofrece «Deshacer», que la devuelve a su sitio", () => {
    useCarrito.getState().agregar("otro", 2);
    useCarrito.getState().agregar("p1", 1);
    useCarrito.getState().agregar("tercero", 1);
    render(<AgregarRapido producto={producto()} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar uno de Cepillo desenredante" }));

    expect(lineasDe("p1")).toEqual([]);
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
    const aviso = vi.mocked(mostrarAviso).mock.lastCall![0];
    expect(aviso.accion?.etiqueta).toBe("Deshacer");

    act(() => aviso.accion!.alHacer!());

    expect(useCarrito.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([
      ["otro", 2],
      ["p1", 1],
      ["tercero", 1],
    ]);
    expect(screen.getByRole("group", { name: "Cantidad de Cepillo desenredante" })).toHaveTextContent("1");
  });

  it("el máximo respeta el stock", () => {
    render(<AgregarRapido producto={producto({ stock: 2 })} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    const mas = screen.getByRole("button", { name: "Agregar uno de Cepillo desenredante" });
    fireEvent.click(mas);
    fireEvent.click(mas);

    expect(lineasDe("p1")[0].cantidad).toBe(2);
    expect(mas).toBeDisabled();
  });
});
