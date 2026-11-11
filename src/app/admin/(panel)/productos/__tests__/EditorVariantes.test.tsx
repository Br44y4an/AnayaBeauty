// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditorVariantes } from "../EditorVariantes";
import type { Variante } from "@/lib/types";

const VARIANTES: Variante[] = [
  { id: "v1", nombre: "Tono 1", colorHex: "#aa0000", orden: 0, agotado: false },
  { id: "v2", nombre: "Tono 2", colorHex: "#00aa00", orden: 1, agotado: false },
  { id: "v3", nombre: "Tono 3", colorHex: "#0000aa", orden: 2, agotado: true },
];

function enviadas(contenedor: HTMLElement) {
  const campo = contenedor.querySelector<HTMLInputElement>('input[name="variantes"]');
  return JSON.parse(campo!.value) as { id: string | null; nombre: string; agotado: boolean }[];
}

describe("EditorVariantes", () => {
  it("envía las variantes con su id en el orden de la foto", () => {
    const { container } = render(<EditorVariantes iniciales={VARIANTES} etiqueta="Tono" />);
    expect(enviadas(container).map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(screen.getByRole("button", { name: "Subir Tono 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Tono 3" })).toBeDisabled();
  });

  it("bajar una variante cambia el orden sin perder su id y deja el foco en ella", () => {
    const { container } = render(<EditorVariantes iniciales={VARIANTES} etiqueta="Tono" />);
    fireEvent.click(screen.getByRole("button", { name: "Bajar Tono 1" }));

    expect(enviadas(container).map((v) => v.id)).toEqual(["v2", "v1", "v3"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bajar Tono 1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tono 1 quedó en la posición 2.");
  });

  it("marcar Agotado no quita la variante", () => {
    const { container } = render(<EditorVariantes iniciales={VARIANTES} etiqueta="Tono" />);
    fireEvent.click(screen.getByRole("switch", { name: "Agotado: Tono 2" }));

    expect(enviadas(container)).toHaveLength(3);
    expect(enviadas(container)[1]).toMatchObject({ id: "v2", agotado: true });
  });

  it("quitar avisa que se borra al guardar y agregar crea una fila nueva sin id", () => {
    const { container } = render(<EditorVariantes iniciales={VARIANTES} etiqueta="Color" />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar Tono 2" }));
    expect(screen.getByRole("status")).toHaveTextContent("Quitaste Tono 2. Se borra al guardar.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar color" }));
    expect(enviadas(container).map((v) => v.id)).toEqual(["v1", "v3", null]);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nombre de la fila 3" }));
  });

  it("sin variantes explica que la clienta elige solo la cantidad", () => {
    render(<EditorVariantes iniciales={[]} etiqueta="Diseño" />);
    expect(screen.getByText("Sin diseños: la clienta elige solo la cantidad.")).toBeInTheDocument();
  });
});
