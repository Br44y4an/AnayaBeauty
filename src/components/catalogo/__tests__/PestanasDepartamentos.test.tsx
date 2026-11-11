// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PestanasDepartamentos } from "@/components/catalogo/PestanasDepartamentos";
import { urlCatalogo } from "@/lib/rutas";

const DEPARTAMENTOS = [
  { id: "d1", nombre: "Rostro", slug: "rostro" },
  { id: "d2", nombre: "Ojos y cejas", slug: "ojos-y-cejas" },
  { id: "d3", nombre: "Labios", slug: "labios" },
];

describe("PestanasDepartamentos", () => {
  it("pinta «Todo» y cada departamento con su enlace de urlCatalogo, conservando el orden elegido", () => {
    render(<PestanasDepartamentos departamentos={DEPARTAMENTOS} activo="labios" orden="precio-asc" />);

    const nav = screen.getByRole("navigation", { name: "Departamentos" });
    const enlaces = within(nav).getAllByRole("link");
    expect(enlaces.map((e) => e.textContent)).toEqual(["Todo", "Rostro", "Ojos y cejas", "Labios"]);

    expect(within(nav).getByRole("link", { name: "Todo" })).toHaveAttribute(
      "href",
      urlCatalogo({ orden: "precio-asc" })
    );
    for (const d of DEPARTAMENTOS) {
      expect(within(nav).getByRole("link", { name: d.nombre })).toHaveAttribute(
        "href",
        urlCatalogo({ categoria: d.slug, orden: "precio-asc" })
      );
    }
  });

  it("la activa lleva aria-current=\"page\" y las demás no", () => {
    render(<PestanasDepartamentos departamentos={DEPARTAMENTOS} activo="labios" orden="destacados" />);

    expect(screen.getByRole("link", { name: "Labios" })).toHaveAttribute("aria-current", "page");
    for (const nombre of ["Todo", "Rostro", "Ojos y cejas"]) {
      expect(screen.getByRole("link", { name: nombre })).not.toHaveAttribute("aria-current");
    }
  });

  it("sin departamento elegido la activa es «Todo»", () => {
    render(<PestanasDepartamentos departamentos={DEPARTAMENTOS} activo={null} orden="destacados" />);

    expect(screen.getByRole("link", { name: "Todo" })).toHaveAttribute("aria-current", "page");
  });

  it("en una búsqueda sin departamento ninguna está activa: «Todo» sirve para salir de ella", () => {
    render(
      <PestanasDepartamentos departamentos={DEPARTAMENTOS} activo={null} orden="destacados" hayBusqueda />
    );

    expect(screen.getByRole("link", { name: "Todo" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });
});
