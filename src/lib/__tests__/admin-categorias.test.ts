import { describe, it, expect } from "vitest";
import { madresPosibles, moverCategoria, ordenAlFinal, validarCategoria } from "@/lib/admin/categorias";
import type { Categoria } from "@/lib/types";

function categoria(id: string, extra: Partial<Categoria> = {}): Categoria {
  return { id, nombre: id, slug: id, orden: 0, categoriaPadreId: null, etiquetaVariante: null, ...extra };
}

const CATEGORIAS: Categoria[] = [
  categoria("labios", { nombre: "Labios", orden: 30, etiquetaVariante: "Tono" }),
  categoria("rostro", { nombre: "Rostro", orden: 10 }),
  categoria("gloss", { nombre: "Lip gloss", slug: "lip-gloss", orden: 10, categoriaPadreId: "labios" }),
  categoria("barra", { nombre: "Labial en barra", slug: "labial-en-barra", orden: 20, categoriaPadreId: "labios" }),
  categoria("liquidos", { nombre: "Labiales líquidos", slug: "labiales-liquidos", orden: 20, categoriaPadreId: "labios" }),
  categoria("espejos", { nombre: "Espejos", orden: 40 }),
];

const ids = (lista: Categoria[]) => lista.map((c) => c.id);

describe("madresPosibles", () => {
  it("solo ofrece categorías de primer nivel, sin la propia", () => {
    expect(ids(madresPosibles(CATEGORIAS, "espejos"))).toEqual(["rostro", "labios"]);
    expect(ids(madresPosibles(CATEGORIAS, null))).toEqual(["rostro", "labios", "espejos"]);
  });

  it("una hija puede cambiar de madre", () => {
    expect(ids(madresPosibles(CATEGORIAS, "gloss"))).toEqual(["rostro", "labios", "espejos"]);
  });

  it("una categoría con hijas no puede ir dentro de otra", () => {
    expect(madresPosibles(CATEGORIAS, "labios")).toEqual([]);
  });
});

describe("moverCategoria", () => {
  it("sube entre sus hermanas y solo escribe los órdenes que cambian", () => {
    // Hermanas en Labios por orden y nombre: gloss (10), barra (20), liquidos (20).
    expect(moverCategoria(CATEGORIAS, "liquidos", -1)).toEqual([{ id: "barra", orden: 30 }]);
  });

  it("baja la primera de las raíces y renumera su nivel de 10 en 10", () => {
    expect(moverCategoria(CATEGORIAS, "rostro", 1)).toEqual([
      { id: "labios", orden: 10 },
      { id: "rostro", orden: 20 },
      { id: "espejos", orden: 30 },
    ]);
  });

  it("no hace nada en los extremos ni con un id desconocido", () => {
    expect(moverCategoria(CATEGORIAS, "gloss", -1)).toEqual([]);
    expect(moverCategoria(CATEGORIAS, "espejos", 1)).toEqual([]);
    expect(moverCategoria(CATEGORIAS, "no-existe", 1)).toEqual([]);
  });

  it("deshace empates de orden sin mover las de otro nivel", () => {
    const planas = [categoria("a", { orden: 4 }), categoria("b", { orden: 4 }), categoria("c", { orden: 5 })];
    expect(moverCategoria(planas, "c", -1)).toEqual([
      { id: "a", orden: 10 },
      { id: "c", orden: 20 },
      { id: "b", orden: 30 },
    ]);
  });
});

describe("ordenAlFinal", () => {
  it("pone la nueva después de la última de su nivel", () => {
    expect(ordenAlFinal(CATEGORIAS, null)).toBe(50);
    expect(ordenAlFinal(CATEGORIAS, "labios")).toBe(30);
    expect(ordenAlFinal(CATEGORIAS, "rostro")).toBe(10);
  });
});

describe("validarCategoria", () => {
  const entrada = (extra: Partial<Parameters<typeof validarCategoria>[0]> = {}) => ({
    id: null,
    nombre: "Delineadores",
    madreId: "",
    etiqueta: "",
    ...extra,
  });

  it("limpia el nombre y deja en null la madre y la etiqueta vacías", () => {
    expect(validarCategoria(entrada({ nombre: "  Polvos   sueltos " }), CATEGORIAS)).toEqual({
      ok: true,
      categoria: { nombre: "Polvos sueltos", slug: "polvos-sueltos", categoriaPadreId: null, etiquetaVariante: null },
    });
  });

  it("acepta una madre de primer nivel y una etiqueta válida", () => {
    const resultado = validarCategoria(entrada({ madreId: "labios", etiqueta: "Color" }), CATEGORIAS);
    expect(resultado).toMatchObject({ ok: true, categoria: { categoriaPadreId: "labios", etiquetaVariante: "Color" } });
  });

  it("exige el nombre y rechaza uno demasiado largo", () => {
    expect(validarCategoria(entrada({ nombre: "  " }), CATEGORIAS)).toEqual({
      ok: false,
      error: "Revisa los campos marcados.",
      campos: { nombre: "Escribe el nombre." },
    });
    expect(validarCategoria(entrada({ nombre: "x".repeat(61) }), CATEGORIAS).ok).toBe(false);
  });

  it("no deja crear otra con el mismo nombre, sin importar tildes ni mayúsculas", () => {
    expect(validarCategoria(entrada({ nombre: "labiales liquidos" }), CATEGORIAS)).toMatchObject({
      ok: false,
      campos: { nombre: "Ya existe la categoría «Labiales líquidos»." },
    });
  });

  it("renombrar a su propio nombre con otras mayúsculas sí se puede", () => {
    expect(validarCategoria(entrada({ id: "espejos", nombre: "ESPEJOS" }), CATEGORIAS).ok).toBe(true);
  });

  it("al renombrar, el slug no cambia: se devuelve null", () => {
    const resultado = validarCategoria(entrada({ id: "gloss", nombre: "Brillos", madreId: "labios" }), CATEGORIAS);
    expect(resultado).toMatchObject({ ok: true, categoria: { nombre: "Brillos", slug: null } });
  });

  it("rechaza una madre que es subcategoría, que no existe o que es ella misma", () => {
    for (const madreId of ["gloss", "no-existe", "espejos"]) {
      expect(validarCategoria(entrada({ id: "espejos", madreId }), CATEGORIAS)).toMatchObject({
        ok: false,
        campos: { categoria_padre_id: "Elige un departamento de la lista." },
      });
    }
  });

  it("una categoría con subcategorías no puede ir dentro de otra", () => {
    expect(validarCategoria(entrada({ id: "labios", nombre: "Labios", madreId: "rostro" }), CATEGORIAS)).toMatchObject({
      ok: false,
      campos: { categoria_padre_id: "Labios tiene subcategorías: no puede ir dentro de otra." },
    });
  });

  it("rechaza una etiqueta inventada y un nombre sin letras ni números", () => {
    expect(validarCategoria(entrada({ etiqueta: "Sabor" }), CATEGORIAS)).toMatchObject({
      ok: false,
      campos: { etiqueta_variante: "Elige una de las opciones de la lista." },
    });
    expect(validarCategoria(entrada({ nombre: "♡♡" }), CATEGORIAS)).toMatchObject({
      ok: false,
      campos: { nombre: "Usa letras o números en el nombre." },
    });
  });
});
