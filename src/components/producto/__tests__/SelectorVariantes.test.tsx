// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { SelectorVariantes } from "@/components/producto/SelectorVariantes";
import { tituloSelector } from "@/lib/variantes";
import type { Variante } from "@/lib/types";

function variante(id: string, nombre: string, orden: number, extra: Partial<Variante> = {}): Variante {
  return { id, nombre, orden, colorHex: "#ffffff", agotado: false, ...extra };
}

function pintar(variantes: Variante[], props: Partial<ComponentProps<typeof SelectorVariantes>> = {}) {
  const alCambiar = vi.fn();
  render(
    <SelectorVariantes
      variantes={variantes}
      etiqueta="Tono"
      seleccion={{}}
      enBolsa={{}}
      disponibles={50}
      alCambiar={alCambiar}
      {...props}
    />
  );
  return { alCambiar };
}

const filas = () => screen.getAllByRole("listitem");
const textos = () => filas().map((fila) => fila.textContent);
const con = (texto: string) => expect.stringContaining(texto);

const NUMERADAS = [variante("a", "Tono 1", 0), variante("b", "Tono 2", 1), variante("c", "Tono 3", 2)];

describe("SelectorVariantes", () => {
  it("pinta una fila por variante en el orden de la foto, sin agrupar por familia", () => {
    pintar([
      variante("c", "Vino 3", 2, { colorHex: "#800020" }),
      variante("a", "Rojo 1", 0, { colorHex: "#cc0000" }),
      variante("d", "Nude 4", 3, { colorHex: "#d8b4a0" }),
      variante("b", "Rosa 2", 1, { colorHex: "#ff99cc" }),
    ]);

    expect(textos()).toEqual([con("Rojo 1"), con("Rosa 2"), con("Vino 3"), con("Nude 4")]);
    for (const familia of ["Rojos", "Rosados", "Nudes", "Neutros"]) {
      expect(screen.queryByText(familia)).not.toBeInTheDocument();
    }
  });

  it("el título es el de la etiqueta del producto", () => {
    pintar(NUMERADAS, { etiqueta: "Paleta" });
    expect(screen.getByRole("heading", { name: tituloSelector("Paleta") })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: tituloSelector("Paleta") })).toBeInTheDocument();
  });

  it("una variante agotada dice «Agotado» y no tiene stepper", () => {
    pintar([variante("a", "Tono 1", 0), variante("b", "Tono 2", 1, { agotado: true })]);
    const [disponible, agotada] = filas();

    expect(within(agotada).getByText("Agotado")).toBeInTheDocument();
    expect(within(agotada).queryByRole("group")).not.toBeInTheDocument();
    expect(within(disponible).getByRole("group", { name: "Cantidad de Tono 1" })).toBeInTheDocument();
  });

  it("con 13 variantes ofrece «Buscar entre 13 tonos» y filtrar conserva el orden", () => {
    const nombres = ["Rojo 1", "Rosa 2", "Coral 3", "Nude 4", "Vino 5", "Lila 6", "Malva 7", "Arena 8"];
    nombres.push("Cereza 9", "Miel 10", "Uva 11", "Canela 12", "Fresa 14");
    pintar(nombres.map((nombre, i) => variante(`v${i}`, nombre, i)).reverse());

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar entre 13 tonos" }), {
      target: { value: "4" },
    });

    expect(textos()).toEqual([con("Nude 4"), con("Fresa 14")]);
  });

  it("con 12 variantes o menos no hay buscador", () => {
    pintar(Array.from({ length: 12 }, (_, i) => variante(`v${i}`, `Tono ${i + 1}`, i)));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  // La ficha lee la marca con :has() para ensanchar la compra en escritorio y pasar a dos columnas.
  it("desde 13 variantes la sección se marca como lista larga; con 12, no", () => {
    const lista = (n: number) => Array.from({ length: n }, (_, i) => variante(`v${i}`, `Tono ${i + 1}`, i));
    const seccion = () => screen.getByRole("region", { name: tituloSelector("Tono") });

    pintar(lista(13));
    expect(seccion()).toHaveAttribute("data-lista-larga");
    cleanup();

    pintar(lista(12));
    expect(seccion()).not.toHaveAttribute("data-lista-larga");
  });

  it("si nada coincide lo dice y deja la lista vacía", () => {
    pintar(Array.from({ length: 13 }, (_, i) => variante(`v${i}`, `Tono ${i + 1}`, i)), { etiqueta: "Color" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar entre 13 colores" }), {
      target: { value: "azul" },
    });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/No encontramos "azul"/)).toBeInTheDocument();
  });

  it("sin muestras confiables no pinta ningún círculo", () => {
    pintar([
      variante("a", "Rosado", 0, { colorHex: "#ffb8db" }),
      variante("b", "Rosado claro", 1, { colorHex: "#ffbadb" }),
    ]);
    expect(screen.queryAllByTestId("muestra")).toHaveLength(0);
  });

  it("con muestras confiables pinta un círculo por fila", () => {
    pintar([
      variante("a", "Rosado", 0, { colorHex: "#ffb8db" }),
      variante("b", "Azul", 1, { colorHex: "#a8b7ff" }),
    ]);
    expect(screen.queryAllByTestId("muestra")).toHaveLength(2);
  });

  it("con nombres «Tono N» explica que la numeración es la de la foto", () => {
    pintar(NUMERADAS);
    expect(screen.getByText("La numeración corresponde a la foto. Tócala para ampliarla.")).toBeInTheDocument();
  });

  it("con nombres reales no habla de numeración", () => {
    pintar([variante("a", "Rosado", 0), variante("b", "Azul", 1)]);
    expect(screen.queryByText(/numeración/)).not.toBeInTheDocument();
  });

  it("el máximo de cada fila descuenta lo elegido en las demás", () => {
    const { alCambiar } = pintar(NUMERADAS, { disponibles: 3, seleccion: { a: 2 } });

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno de Tono 2" }));
    expect(alCambiar).toHaveBeenCalledWith("b", 1);
    expect(screen.getByRole("button", { name: "Agregar uno de Tono 1" })).toBeEnabled();
  });

  it("sin unidades libres los botones de sumar quedan inactivos", () => {
    pintar(NUMERADAS, { disponibles: 3, seleccion: { a: 2, b: 1 } });

    expect(screen.getByRole("button", { name: "Agregar uno de Tono 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar uno de Tono 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar uno de Tono 2" })).toBeEnabled();
  });

  it("dice cuántas lleva ya en la bolsa de cada variante", () => {
    pintar(NUMERADAS, { enBolsa: { b: 2 } });
    expect(within(filas()[1]).getByText("En tu bolsa: 2")).toBeInTheDocument();
    expect(within(filas()[0]).queryByText(/En tu bolsa/)).not.toBeInTheDocument();
  });

  it("el error se lee como descripción de la lista", () => {
    pintar(NUMERADAS, { error: "Elige al menos un tono" });
    expect(screen.getByRole("list", { name: "Elige el tono" })).toHaveAccessibleDescription(
      "Elige al menos un tono"
    );
  });
});
