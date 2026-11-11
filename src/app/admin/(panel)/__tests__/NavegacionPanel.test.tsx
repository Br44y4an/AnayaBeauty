// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const prueba = vi.hoisted(() => ({ ruta: "/admin" }));

vi.mock("next/navigation", () => ({ usePathname: () => prueba.ruta }));
vi.mock("../login/actions", () => ({ cerrarSesion: vi.fn() }));
vi.mock("../PedidosEnVivo", () => ({ useEnVivo: () => ({ nuevos: 3, conexion: "en-vivo", abiertoDesde: 0 }) }));

import { NavegacionPanel } from "../NavegacionPanel";

beforeEach(() => {
  prueba.ruta = "/admin";
});

// jsdom no aplica las clases `hidden`/`lg:flex`: las dos navegaciones existen en el DOM.
function barraInferior() {
  return screen.getAllByRole("navigation", { name: "Panel" })[1];
}

describe("NavegacionPanel", () => {
  it("la barra inferior tiene 4 destinos y Pedidos lleva el contador de nuevos", () => {
    render(<NavegacionPanel />);
    const barra = within(barraInferior());

    expect(barra.getAllByRole("listitem")).toHaveLength(4);
    const pedidos = barra.getByRole("link", { name: /Pedidos/ });
    expect(pedidos).toHaveAccessibleName("Pedidos, 3 nuevos");
    expect(pedidos).toHaveAttribute("aria-current", "page");
    expect(barra.getByRole("button", { name: "Más" })).toHaveAttribute("aria-expanded", "false");
  });

  it("marca la sección actual también en las subpáginas", () => {
    prueba.ruta = "/admin/productos/abc";
    render(<NavegacionPanel />);
    const barra = within(barraInferior());

    expect(barra.getByRole("link", { name: "Productos" })).toHaveAttribute("aria-current", "page");
    expect(barra.getByRole("link", { name: /Pedidos/ })).not.toHaveAttribute("aria-current");
  });

  it("«Más» abre el resto de secciones, la tienda en otra pestaña y Salir", () => {
    prueba.ruta = "/admin/qr";
    render(<NavegacionPanel />);
    fireEvent.click(within(barraInferior()).getByRole("button", { name: "Más" }));

    const hoja = within(screen.getByRole("dialog", { name: "Más opciones" }));
    for (const nombre of ["Categorías", "Descuentos", "Ajustes"]) {
      expect(hoja.getByRole("link", { name: nombre })).toBeInTheDocument();
    }
    expect(hoja.getByRole("link", { name: "Código QR" })).toHaveAttribute("aria-current", "page");
    expect(hoja.getByRole("link", { name: /Ver la tienda/ })).toHaveAttribute("target", "_blank");
    expect(hoja.getByRole("button", { name: "Salir" })).toBeInTheDocument();
  });
});
