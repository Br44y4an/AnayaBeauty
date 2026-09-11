import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SelectorTonos } from "@/components/producto/SelectorTonos";
import type { Tono } from "@/lib/types";

function tono(nombre: string, colorHex: string, orden = 0): Tono {
  return { id: `${nombre}`, nombre, colorHex, orden };
}

const CORTA = [
  tono("Rubí", "#e01b24"),
  tono("Rosa Palo", "#e8b4c8"),
  tono("Nude Café", "#c9a086"),
];

/** 16 tonos: por encima del umbral que activa el buscador y el agrupado. */
const LARGA = [
  tono("Rubí", "#e01b24"),
  tono("Carmín", "#c01515"),
  tono("Cereza", "#d02040"),
  tono("Rosa Palo", "#e8b4c8"),
  tono("Fucsia", "#e5308a"),
  tono("Orquídea", "#d070b0"),
  tono("Nude Café", "#c9a086"),
  tono("Beige", "#d8b49c"),
  tono("Arena", "#cbab8f"),
  tono("Mandarina", "#ff6600"),
  tono("Durazno", "#ff8844"),
  tono("Oliva", "#6b8e23"),
  tono("Menta", "#2ec27e"),
  tono("Cielo", "#1c71d8"),
  tono("Uva", "#9141ac"),
  tono("Perla", "#fdf6f0"),
];

describe("SelectorTonos", () => {
  it("muestra el NOMBRE de cada tono, no solo el color", () => {
    // El cambio clave: antes eran círculos de 28px sin texto, y para
    // saber cuál era "el Rubí" había que ir tocándolos uno por uno.
    render(<SelectorTonos tonos={CORTA} elegido={null} alElegir={() => {}} />);

    for (const t of CORTA) {
      expect(screen.getByRole("radio", { name: new RegExp(t.nombre, "i") })).toBeInTheDocument();
    }
  });

  it("avisa al elegir y lo confirma en texto", () => {
    const alElegir = vi.fn();
    const { rerender } = render(
      <SelectorTonos tonos={CORTA} elegido={null} alElegir={alElegir} />
    );

    fireEvent.click(screen.getByRole("radio", { name: /rubí/i }));
    expect(alElegir).toHaveBeenCalledWith(CORTA[0]);

    rerender(<SelectorTonos tonos={CORTA} elegido={CORTA[0]} alElegir={alElegir} />);

    // El anillo de color no se "oye": hace falta decirlo en texto.
    expect(screen.getByText(/elegiste: rubí/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /rubí/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("no pone buscador en una paleta corta: sobraría", () => {
    render(<SelectorTonos tonos={CORTA} elegido={null} alElegir={() => {}} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("pone buscador cuando la paleta es larga", () => {
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);

    const campo = screen.getByRole("searchbox");
    expect(campo).toBeInTheDocument();
    // El marcador dice cuántos hay: sitúa a la clienta antes de buscar.
    expect(campo).toHaveAttribute("placeholder", expect.stringContaining("16"));
  });

  it("filtra por nombre ignorando tildes", () => {
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);

    // La clienta escribe "rubi" en el teclado del celular, sin tilde.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rubi" } });

    expect(screen.getByRole("radio", { name: /rubí/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /cielo/i })).not.toBeInTheDocument();
  });

  it("explica qué hacer cuando la búsqueda no encuentra nada", () => {
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "turquesa" } });

    expect(screen.getByText(/no hay ningún tono que se llame así/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("permite borrar la búsqueda de un toque", () => {
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);
    const campo = screen.getByRole("searchbox");

    fireEvent.change(campo, { target: { value: "rubi" } });
    fireEvent.click(screen.getByRole("button", { name: /borrar la búsqueda/i }));

    expect(campo).toHaveValue("");
    expect(screen.getAllByRole("radio")).toHaveLength(LARGA.length);
  });

  it("agrupa la paleta larga por familia de color", () => {
    // Nadie busca "#c9a086": busca "un nude". Los títulos convierten un
    // muro de 16 puntos en algo que se puede recorrer con la vista.
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);

    expect(screen.getByText("Rojos")).toBeInTheDocument();
    expect(screen.getByText("Nudes")).toBeInTheDocument();
    expect(screen.getByText("Azules")).toBeInTheDocument();
  });

  it("no pierde ningún tono al agrupar", () => {
    render(<SelectorTonos tonos={LARGA} elegido={null} alElegir={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(LARGA.length);
  });

  it("expone el grupo como radiogroup para el lector de pantalla", () => {
    render(<SelectorTonos tonos={CORTA} elegido={null} alElegir={() => {}} />);

    const grupo = screen.getByRole("radiogroup");
    expect(within(grupo).getAllByRole("radio")).toHaveLength(CORTA.length);
  });

  it("no pinta nada si el producto no tiene tonos", () => {
    const { container } = render(
      <SelectorTonos tonos={[]} elegido={null} alElegir={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
