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

/** El color que el formulario del panel trae puesto: casi nunca es el real. */
const HEX_POR_DEFECTO = "e5308a";
const DISTANCIA_MINIMA = 10;

type Lab = [number, number, number];

function hexALab(hex: string): Lab | null {
  const limpio = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1].toLowerCase();
  if (!limpio || limpio === HEX_POR_DEFECTO) return null;

  const lineal = (canal: number) => {
    const v = canal / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => lineal(parseInt(limpio.slice(i, i + 2), 16)));

  // sRGB → XYZ (D65) → CIELAB
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Solo se pintan círculos si TODOS los colores son creíbles: hex válido, no
 * el valor por defecto y distinguibles entre sí (ΔE76 ≥ 10).
 */
export function muestrasConfiables(variantes: Pick<Variante, "colorHex">[]): boolean {
  if (variantes.length === 0) return false;

  const colores: Lab[] = [];
  for (const { colorHex } of variantes) {
    const lab = hexALab(colorHex ?? "");
    if (!lab) return false;
    colores.push(lab);
  }

  for (let i = 0; i < colores.length; i++) {
    for (let j = i + 1; j < colores.length; j++) {
      const [a, b] = [colores[i], colores[j]];
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < DISTANCIA_MINIMA) return false;
    }
  }
  return true;
}

/** «Tono 1», «Tono 2 modelo K»: el número es la posición en la foto. */
export function esNumeracionDeFoto(variantes: Pick<Variante, "nombre">[]): boolean {
  return variantes.length > 0 && variantes.every((v) => /^tono\s*\d+\b/i.test(v.nombre.trim()));
}
