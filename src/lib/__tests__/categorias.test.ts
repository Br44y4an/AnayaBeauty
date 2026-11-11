import { describe, it, expect } from "vitest";
import { arbolDeCategorias, departamentoDe, idsDeCategoria } from "@/lib/categorias";
import type { Categoria } from "@/lib/types";

function categoria(
  id: string,
  nombre: string,
  slug: string,
  orden: number,
  categoriaPadreId: string | null = null
): Categoria {
  return { id, nombre, slug, orden, categoriaPadreId, etiquetaVariante: null };
}

const labios = categoria("c-labios", "Labios", "labios", 30);
const gloss = categoria("c-gloss", "Lip gloss", "lip-gloss", 10, "c-labios");
const barra = categoria("c-barra", "Labial en barra", "labial-en-barra", 11, "c-labios");
const sombras = categoria("c-sombras", "Sombras", "sombras", 1);

// Desordenadas a propósito: el árbol no puede depender del orden de llegada.
const categorias = [barra, labios, sombras, gloss];

describe("arbolDeCategorias", () => {
  it("devuelve las raíces ordenadas por orden, con sus hijas", () => {
    const arbol = arbolDeCategorias(categorias);

    expect(arbol.map((d) => d.slug)).toEqual(["sombras", "labios"]);
    expect(arbol[1].hijas.map((c) => c.slug)).toEqual(["lip-gloss", "labial-en-barra"]);
    expect(arbol[0].hijas).toEqual([]);
  });

  it("muestra como raíz una hija cuyo padre no está en la lista", () => {
    const huerfana = categoria("c-huerfana", "Huérfana", "huerfana", 5, "c-oculta");
    const arbol = arbolDeCategorias([...categorias, huerfana]);

    expect(arbol.map((d) => d.slug)).toEqual(["sombras", "huerfana", "labios"]);
  });

  it("desempata por nombre cuando dos raíces tienen el mismo orden", () => {
    const b = categoria("b", "Brochas", "brochas", 12);
    const a = categoria("a", "Accesorios", "accesorios", 12);

    expect(arbolDeCategorias([b, a]).map((d) => d.slug)).toEqual(["accesorios", "brochas"]);
  });
});

describe("idsDeCategoria", () => {
  it("una madre incluye a sus hijas", () => {
    expect(idsDeCategoria("labios", categorias)).toEqual(["c-labios", "c-gloss", "c-barra"]);
  });

  it("una hija se incluye solo a sí misma", () => {
    expect(idsDeCategoria("lip-gloss", categorias)).toEqual(["c-gloss"]);
  });

  it("un slug desconocido no filtra por nada conocido", () => {
    expect(idsDeCategoria("no-existe", categorias)).toBeNull();
  });
});

describe("departamentoDe", () => {
  it("devuelve la madre de una hija", () => {
    expect(departamentoDe("c-gloss", categorias)).toBe(labios);
  });

  it("una raíz es su propio departamento", () => {
    expect(departamentoDe("c-sombras", categorias)).toBe(sombras);
  });

  it("no inventa un departamento para algo desconocido", () => {
    expect(departamentoDe(null, categorias)).toBeNull();
    expect(departamentoDe("c-oculta", categorias)).toBeNull();
  });
});
