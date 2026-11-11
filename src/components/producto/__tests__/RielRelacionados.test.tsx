// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Producto } from "@/lib/types";

// Sin router de Next, el enlace se reemplaza por un <a> que deja ver cómo navegaría.
vi.mock("next/link", () => ({
  default: ({ href, replace, scroll, prefetch: _prefetch, ...props }: ComponentProps<"a"> & {
    href: string;
    replace?: boolean;
    scroll?: boolean;
    prefetch?: boolean;
  }) => <a href={href} data-replace={String(Boolean(replace))} data-scroll={String(scroll ?? true)} {...props} />,
  useLinkStatus: () => ({ pending: false }),
}));

import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { RielRelacionados } from "@/components/producto/RielRelacionados";

function producto(n: number, cambios: Partial<Producto> = {}): Producto {
  return {
    id: `p${n}`,
    referencia: `REF-${n}/A`,
    nombre: `Producto ${n}`,
    descripcion: null,
    categoriaId: "c1",
    categoriaNombre: "Lip gloss",
    categoriaSlug: "lip-gloss",
    imagenPrincipal: null,
    galeria: [],
    stock: 10,
    activo: true,
    destacado: false,
    escalones: [{ minCantidad: 1, precioUnitario: 8000 }],
    etiquetaVariante: "Tono",
    numVariantes: 0,
    variantes: null,
    ...cambios,
  };
}

describe("TarjetaProducto · replace", () => {
  it("por defecto agrega una entrada al historial", () => {
    render(<TarjetaProducto producto={producto(1)} compacta />);
    expect(screen.getByRole("link")).toHaveAttribute("data-replace", "false");
  });

  it("con replace reemplaza la entrada y no mueve la página de atrás", () => {
    render(<TarjetaProducto producto={producto(1)} compacta replace />);

    const enlace = screen.getByRole("link");
    expect(enlace).toHaveAttribute("href", "/producto/REF-1%2FA");
    expect(enlace).toHaveAttribute("data-replace", "true");
    expect(enlace).toHaveAttribute("data-scroll", "false");
  });
});

describe("RielRelacionados", () => {
  it("dentro del modal usa la tarjeta compacta y cada salto reemplaza la entrada", () => {
    render(<RielRelacionados productos={[producto(1), producto(2)]} titulo="Más de Lip gloss" enModal />);

    expect(screen.getByRole("heading", { level: 3, name: "Más de Lip gloss" })).toBeInTheDocument();
    const enlaces = screen.getAllByRole("link");
    expect(enlaces.map((a) => a.getAttribute("data-replace"))).toEqual(["true", "true"]);
    // La tarjeta compacta: un artículo con nombre y precio por producto.
    expect(screen.getByRole("article", { name: "Producto 2" })).toHaveTextContent("$8.000");
  });

  it("en la página completa los saltos agregan una entrada", () => {
    render(<RielRelacionados productos={[producto(1)]} titulo="Más de Lip gloss" enModal={false} />);

    expect(screen.getByRole("heading", { level: 2, name: "Más de Lip gloss" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("data-replace", "false");
  });

  it("sin productos no pinta nada y nunca muestra más de 8", () => {
    const { container, rerender } = render(<RielRelacionados productos={[]} titulo="Más" enModal />);
    expect(container).toBeEmptyDOMElement();

    rerender(<RielRelacionados productos={Array.from({ length: 12 }, (_, i) => producto(i))} titulo="Más" enModal />);
    expect(screen.getAllByRole("link")).toHaveLength(8);
  });
});
