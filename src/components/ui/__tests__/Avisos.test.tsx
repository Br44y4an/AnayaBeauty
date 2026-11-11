// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Avisos } from "@/components/ui/Avisos";
import { avisoActual, cerrarAviso, mostrarAviso } from "@/lib/avisos";

describe("Avisos", () => {
  afterEach(() => act(() => cerrarAviso()));

  it("sin aviso deja la región viva vacía", () => {
    render(<Avisos />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("muestra título y detalle en la región viva y «Ver bolsa» como enlace a /carrito", () => {
    render(<Avisos />);

    act(() =>
      mostrarAviso({
        titulo: "Agregado a tu bolsa",
        detalle: "3 × Brillo labial Oil Glazed",
        accion: { etiqueta: "Ver bolsa", href: "/carrito" },
      })
    );

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Agregado a tu bolsa");
    expect(region).toHaveTextContent("3 × Brillo labial Oil Glazed");

    const enlace = screen.getByRole("link", { name: "Ver bolsa" });
    expect(enlace).toHaveAttribute("href", "/carrito");
    expect(enlace.querySelector("button")).toBeNull();
  });

  it("tocar «Ver bolsa» cierra el aviso", () => {
    render(<Avisos />);
    act(() =>
      mostrarAviso({ titulo: "Agregado a tu bolsa", accion: { etiqueta: "Ver bolsa", href: "/carrito" } })
    );

    fireEvent.click(screen.getByRole("link", { name: "Ver bolsa" }));

    expect(avisoActual()).toBeNull();
  });

  it("una acción con alHacer la ejecuta una vez y cierra el aviso", () => {
    const deshacer = vi.fn();
    render(<Avisos />);
    act(() =>
      mostrarAviso({ titulo: "Quitaste Tono 3", accion: { etiqueta: "Deshacer", alHacer: deshacer } })
    );

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(deshacer).toHaveBeenCalledTimes(1);
    expect(avisoActual()).toBeNull();
    expect(screen.queryByText("Quitaste Tono 3")).not.toBeInTheDocument();
  });

  it("un aviso nuevo reemplaza al anterior en pantalla", () => {
    render(<Avisos />);
    act(() => mostrarAviso({ titulo: "Agregado a tu bolsa" }));
    act(() => mostrarAviso({ titulo: "Copiado" }));

    expect(screen.queryByText("Agregado a tu bolsa")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copiado");
  });
});
