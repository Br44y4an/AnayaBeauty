import type { EtiquetaVariante, Variante } from "@/lib/types";

export const ETIQUETAS_VARIANTE: readonly EtiquetaVariante[] = [
  "Tono",
  "Color",
  "Diseño",
  "Modelo",
  "Aroma",
  "Largo",
  "Paleta",
];

const GRAMATICA: Record<EtiquetaVariante, { singular: string; plural: string; femenino: boolean }> = {
  Tono: { singular: "tono", plural: "tonos", femenino: false },
  Color: { singular: "color", plural: "colores", femenino: false },
  Diseño: { singular: "diseño", plural: "diseños", femenino: false },
  Modelo: { singular: "modelo", plural: "modelos", femenino: false },
  Aroma: { singular: "aroma", plural: "aromas", femenino: false },
  Largo: { singular: "largo", plural: "largos", femenino: false },
  Paleta: { singular: "paleta", plural: "paletas", femenino: true },
};

// Las hijas de maquillaje cuentan aunque no tengan madre: con el catálogo
// plano (antes de crear los departamentos, o si se revierten) son raíces.
const DE_TONO = new Set([
  "rostro",
  "ojos-y-cejas",
  "labios",
  "polvos-y-bases",
  "contornos-y-correctores",
  "rubores",
  "iluminadores",
  "sombras",
  "pestanina-y-delineadores",
  "pestanas-postizas",
  "cejas",
  "labial-en-barra",
  "labiales-liquidos",
  "lip-gloss",
]);

export function etiquetaPorDefecto(slugDepartamento: string | null): EtiquetaVariante {
  return slugDepartamento === null || DE_TONO.has(slugDepartamento) ? "Tono" : "Color";
}

export function resolverEtiqueta(o: {
  producto: EtiquetaVariante | null;
  categoria: EtiquetaVariante | null;
  departamento: EtiquetaVariante | null;
  slugDepartamento: string | null;
}): EtiquetaVariante {
  return o.producto ?? o.categoria ?? o.departamento ?? etiquetaPorDefecto(o.slugDepartamento);
}

/** «tono» o «tonos», sin el número. */
export function nombreVariante(etiqueta: EtiquetaVariante, n = 1): string {
  const g = GRAMATICA[etiqueta];
  return n === 1 ? g.singular : g.plural;
}

export function pluralVariante(etiqueta: EtiquetaVariante, n: number): string {
  return `${n} ${nombreVariante(etiqueta, n)}`;
}

/** «un tono», «una paleta». */
export function unaVariante(etiqueta: EtiquetaVariante): string {
  const g = GRAMATICA[etiqueta];
  return `${g.femenino ? "una" : "un"} ${g.singular}`;
}

export function verboElegir(etiqueta: EtiquetaVariante): string {
  return `Elegir ${GRAMATICA[etiqueta].singular}`;
}

export function tituloSelector(etiqueta: EtiquetaVariante): string {
  const g = GRAMATICA[etiqueta];
  return `Elige ${g.femenino ? "la" : "el"} ${g.singular}`;
}

/** El color que el formulario del panel trae puesto: solo es real si el tono se llama así. */
const HEX_POR_DEFECTO = "#e5308a";
const NOMBRE_FUCSIA = /fucsia|fuxia|fucia|rosad|rosa|pink|magenta/i;

/** Color del círculo de un tono, o null si nunca se le eligió un color real. */
export function colorDeMuestra(v: Pick<Variante, "nombre" | "colorHex">): string | null {
  const limpio = /^#?([0-9a-f]{6})$/i.exec((v.colorHex ?? "").trim())?.[1].toLowerCase();
  if (!limpio) return null;
  const hex = `#${limpio}`;
  return hex === HEX_POR_DEFECTO && !NOMBRE_FUCSIA.test(v.nombre) ? null : hex;
}

/** Si al menos un tono tiene color real, el producto pinta círculos. */
export function tieneMuestras(variantes: Pick<Variante, "nombre" | "colorHex">[]): boolean {
  return variantes.some((v) => colorDeMuestra(v) !== null);
}

/** «Tono 1», «Tono 2 modelo K»: el número es la posición en la foto. */
export function esNumeracionDeFoto(variantes: Pick<Variante, "nombre">[]): boolean {
  return variantes.length > 0 && variantes.every((v) => /^tono\s*\d+\b/i.test(v.nombre.trim()));
}
