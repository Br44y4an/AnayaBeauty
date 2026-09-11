import type { Tono } from "@/lib/types";

/**
 * Ayudas para paletas largas.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Hay productos con 30 o 40 tonos. Antes los círculos de color se pintaban
 * todos, siempre, dentro de cada tarjeta del catálogo: la clienta tenía
 * que mirar el muro de colores de productos que ni siquiera le
 * interesaban, y encontrar "el rosado palo" entre 40 puntitos de 28px era
 * imposible en un celular.
 *
 * La solución tiene tres partes y esta es la parte pura:
 *   1. los tonos no se muestran hasta que se piden (hoja de selección);
 *   2. dentro de la hoja se agrupan por familia de color, porque nadie
 *      busca "#c2185b": busca "un rojo";
 *   3. se pueden filtrar por nombre.
 */

export type FamiliaColor =
  | "rojos"
  | "rosados"
  | "naranjas"
  | "nudes"
  | "amarillos"
  | "verdes"
  | "azules"
  | "morados"
  | "neutros";

/** Cómo se le presenta cada familia a la clienta, y en qué orden. */
export const FAMILIAS: { clave: FamiliaColor; etiqueta: string }[] = [
  { clave: "rojos", etiqueta: "Rojos" },
  { clave: "rosados", etiqueta: "Rosados" },
  { clave: "nudes", etiqueta: "Nudes" },
  { clave: "naranjas", etiqueta: "Naranjas" },
  { clave: "amarillos", etiqueta: "Amarillos" },
  { clave: "verdes", etiqueta: "Verdes" },
  { clave: "azules", etiqueta: "Azules" },
  { clave: "morados", etiqueta: "Morados" },
  { clave: "neutros", etiqueta: "Neutros" },
];

export type HSL = { h: number; s: number; l: number };

/** "#e5308a" o "e5308a" → {h,s,l} con h en grados y s/l entre 0 y 1. */
export function hexAHsl(hex: string): HSL | null {
  const limpio = hex.trim().replace(/^#/, "");

  const completo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;

  if (!/^[0-9a-f]{6}$/i.test(completo)) return null;

  const r = parseInt(completo.slice(0, 2), 16) / 255;
  const g = parseInt(completo.slice(2, 4), 16) / 255;
  const b = parseInt(completo.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === r) h = 60 * (((g - b) / delta) % 6);
  else if (max === g) h = 60 * ((b - r) / delta + 2);
  else h = 60 * ((r - g) / delta + 4);

  return { h: (h + 360) % 360, s, l };
}

/**
 * A qué familia pertenece un color.
 *
 * Los nudes son el caso especial y el que más importa en maquillaje: son
 * naranjas/marrones poco saturados. Sin esa regla caían todos en
 * "naranjas" junto a un naranja neón, que es justo lo contrario de lo que
 * la clienta espera.
 */
export function familiaDeColor(hex: string): FamiliaColor {
  const hsl = hexAHsl(hex);
  if (!hsl) return "neutros";

  const { h, s, l } = hsl;

  // Blancos, negros y grises: sin color del que hablar.
  if (s < 0.15 || l < 0.08 || l > 0.93) return "neutros";

  if (h >= 345 || h < 12) return "rojos";
  if (h < 45) return s < 0.55 || l > 0.62 ? "nudes" : "naranjas";
  if (h < 70) return "amarillos";
  if (h < 165) return "verdes";
  if (h < 255) return "azules";
  if (h < 292) return "morados";
  return "rosados";
}

/** Normaliza para comparar: sin tildes, sin mayúsculas, sin espacios extra. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra por nombre de tono. Tolera tildes y mayúsculas porque la clienta
 * escribe "rubi" buscando "Rubí".
 */
export function filtrarTonos(tonos: Tono[], texto: string): Tono[] {
  const busqueda = normalizar(texto);
  if (!busqueda) return tonos;
  return tonos.filter((t) => normalizar(t.nombre).includes(busqueda));
}

export type GrupoTonos = {
  clave: FamiliaColor;
  etiqueta: string;
  tonos: Tono[];
};

/**
 * Agrupa en familias, en el orden de `FAMILIAS` y sin grupos vacíos.
 *
 * Por debajo de `minimoParaAgrupar` no se agrupa: partir seis tonos en
 * cuatro títulos añade ruido en vez de quitarlo. Se devuelve entonces un
 * único grupo sin etiqueta.
 */
export function agruparTonos(tonos: Tono[], minimoParaAgrupar = 10): GrupoTonos[] {
  if (tonos.length < minimoParaAgrupar) {
    return tonos.length ? [{ clave: "neutros", etiqueta: "", tonos }] : [];
  }

  const porFamilia = new Map<FamiliaColor, Tono[]>();
  for (const tono of tonos) {
    const familia = familiaDeColor(tono.colorHex);
    const grupo = porFamilia.get(familia);
    if (grupo) grupo.push(tono);
    else porFamilia.set(familia, [tono]);
  }

  return FAMILIAS.filter((f) => porFamilia.has(f.clave)).map((f) => ({
    clave: f.clave,
    etiqueta: f.etiqueta,
    tonos: porFamilia.get(f.clave)!,
  }));
}

/**
 * ¿El círculo necesita un borde marcado para verse?
 *
 * Un tono blanco o crema sobre fondo blanco desaparece: sin esto la
 * clienta ve un hueco donde debería haber una opción.
 */
export function necesitaBorde(hex: string): boolean {
  const hsl = hexAHsl(hex);
  return hsl === null || hsl.l > 0.82;
}

/** Texto legible encima del color (para la marca de "elegido"). */
export function textoSobre(hex: string): "claro" | "oscuro" {
  const hsl = hexAHsl(hex);
  if (!hsl) return "oscuro";
  return hsl.l > 0.55 ? "oscuro" : "claro";
}
