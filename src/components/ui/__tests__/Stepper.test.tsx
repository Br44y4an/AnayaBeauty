// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "@/components/ui/Stepper";

describe("Stepper", () => {
  it("«Agregar uno de Tono 3» sube uno y «Quitar uno de Tono 3» baja uno", () => {
    const onCambiar = vi.fn();
    render(<Stepper valor={2} max={5} onCambiar={onCambiar} etiqueta="Tono 3" />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 3" }));
    expect(onCambiar).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Quitar uno de Tono 3" }));
    expect(onCambiar).toHaveBeenLastCalledWith(1);
  });

  it("muestra el valor en un <output> que se anuncia", () => {
    render(<Stepper valor={2} max={5} onCambiar={() => {}} etiqueta="Tono 3" />);

    const valor = screen.getByRole("status");
    expect(valor.tagName).toBe("OUTPUT");
    expect(valor).toHaveTextContent("2");
    expect(screen.getByRole("group", { name: "Cantidad de Tono 3" })).toContainElement(valor);
  });

  it("en el máximo no deja agregar", () => {
    const onCambiar = vi.fn();
    render(<Stepper valor={5} max={5} onCambiar={onCambiar} etiqueta="Tono 3" />);

    const agregar = screen.getByRole("button", { name: "Agregar uno de Tono 3" });
    expect(agregar).toBeDisabled();
    fireEvent.click(agregar);
    expect(onCambiar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Quitar uno de Tono 3" })).toBeEnabled();
  });

  it("en el mínimo no deja quitar (0 por defecto, o el que se indique)", () => {
    const { rerender } = render(
      <Stepper valor={0} max={5} onCambiar={() => {}} etiqueta="Tono 3" />
    );
    expect(screen.getByRole("button", { name: "Quitar uno de Tono 3" })).toBeDisabled();

    rerender(<Stepper valor={1} min={1} max={5} onCambiar={() => {}} etiqueta="Tono 3" />);
    expect(screen.getByRole("button", { name: "Quitar uno de Tono 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar uno de Tono 3" })).toBeEnabled();
  });

  it("deshabilitado bloquea los dos botones", () => {
    render(<Stepper valor={2} max={5} onCambiar={() => {}} etiqueta="Tono 3" deshabilitado />);

    expect(screen.getByRole("button", { name: "Agregar uno de Tono 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar uno de Tono 3" })).toBeDisabled();
  });

  it("deshabilitado se ve con fondo inactivo y texto tinta-suave, sin opacidad (como Boton)", () => {
    render(<Stepper valor={0} max={5} onCambiar={() => {}} etiqueta="Tono 3" />);

    const quitar = screen.getByRole("button", { name: "Quitar uno de Tono 3" });
    expect(quitar).toBeDisabled();
    const clases = quitar.className.split(/\s+/);
    expect(clases.filter((clase) => clase.includes("opacity-"))).toEqual([]);
    expect(clases).toContain("disabled:bg-inactivo");
    expect(clases).toContain("disabled:text-tinta-suave");
  });
});
