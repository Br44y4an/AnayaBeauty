import { normalizarTexto } from "@/lib/data/busqueda";
import { generarSlug } from "@/lib/slug";
import { ETIQUETAS_VARIANTE } from "@/lib/variantes";
import type { Categoria, EtiquetaVariante } from "@/lib/types";

const LARGO_MAXIMO = 60;
const PASO_ORDEN = 10;

/** El mismo orden que usan las pestañas de la tienda (`arbolDeCategorias`). */
const porOrden = (a: Categoria, b: Categoria) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");

const hermanas = <T extends Categoria>(categorias: T[], padreId: string | null): T[] =>
  categorias.filter((c) => c.categoriaPadreId === padreId).sort(porOrden);

/** Solo hay dos niveles: la madre es una categoría de primer nivel y quien tiene hijas no puede tener madre. */
export function madresPosibles<T extends Categoria>(categorias: T[], id: string | null): T[] {
  if (id && categorias.some((c) => c.categoriaPadreId === id)) return [];
  return hermanas(categorias, null).filter((c) => c.id !== id);
}

/**
 * Sube o baja una categoría entre las de su mismo nivel y renumera ese nivel de 10 en 10.
 * Devuelve solo los órdenes que cambian; vacío si no se puede mover.
 */
export function moverCategoria(categorias: Categoria[], id: string, paso: -1 | 1): { id: string; orden: number }[] {
  const actual = categorias.find((c) => c.id === id);
  if (!actual) return [];

  const nivel = hermanas(categorias, actual.categoriaPadreId);
  const desde = nivel.indexOf(actual);
  const hasta = desde + paso;
  if (hasta < 0 || hasta >= nivel.length) return [];

  [nivel[desde], nivel[hasta]] = [nivel[hasta], nivel[desde]];
  return nivel
    .map((c, i) => ({ id: c.id, antes: c.orden, orden: (i + 1) * PASO_ORDEN }))
    .filter((c) => c.antes !== c.orden)
    .map(({ id: cambiada, orden }) => ({ id: cambiada, orden }));
}

/** Una categoría nueva entra al final de su nivel. */
export function ordenAlFinal(categorias: Categoria[], padreId: string | null): number {
  return Math.max(0, ...hermanas(categorias, padreId).map((c) => c.orden)) + PASO_ORDEN;
}

export type CategoriaValidada = {
  nombre: string;
  /** null al renombrar: el slug está en las direcciones que ya circulan y no cambia. */
  slug: string | null;
  categoriaPadreId: string | null;
  etiquetaVariante: EtiquetaVariante | null;
};

export type ResultadoCategoria =
  | { ok: true; categoria: CategoriaValidada }
  | { ok: false; error: string; campos: Record<string, string> };

/** `id` null es una categoría nueva. Los textos vacíos de madre y etiqueta son «ninguna». */
export function validarCategoria(
  entrada: { id: string | null; nombre: string; madreId: string; etiqueta: string },
  categorias: Categoria[]
): ResultadoCategoria {
  const campos: Record<string, string> = {};
  const otras = categorias.filter((c) => c.id !== entrada.id);

  const nombre = entrada.nombre.trim().replace(/\s+/g, " ");
  const slug = generarSlug(nombre);
  if (!nombre) campos.nombre = "Escribe el nombre.";
  else if (nombre.length > LARGO_MAXIMO) campos.nombre = `El nombre es muy largo: máximo ${LARGO_MAXIMO} caracteres.`;
  else if (!slug) campos.nombre = "Usa letras o números en el nombre.";
  else {
    const igual = otras.find(
      (c) => normalizarTexto(c.nombre) === normalizarTexto(nombre) || (!entrada.id && c.slug === slug)
    );
    if (igual) campos.nombre = `Ya existe la categoría «${igual.nombre}».`;
  }

  const madreId = entrada.madreId.trim() || null;
  if (madreId && !madresPosibles(categorias, entrada.id).some((c) => c.id === madreId)) {
    const propia = categorias.find((c) => c.id === entrada.id);
    const tieneHijas = propia && categorias.some((c) => c.categoriaPadreId === propia.id);
    campos.categoria_padre_id = tieneHijas
      ? `${propia.nombre} tiene subcategorías: no puede ir dentro de otra.`
      : "Elige un departamento de la lista.";
  }

  const etiquetaVariante = ETIQUETAS_VARIANTE.find((e) => e === entrada.etiqueta) ?? null;
  if (entrada.etiqueta && !etiquetaVariante) campos.etiqueta_variante = "Elige una de las opciones de la lista.";

  if (Object.keys(campos).length > 0) return { ok: false, error: "Revisa los campos marcados.", campos };
  return {
    ok: true,
    categoria: { nombre, slug: entrada.id ? null : slug, categoriaPadreId: madreId, etiquetaVariante },
  };
}
