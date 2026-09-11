/**
 * Contraste de color según WCAG 2.1.
 *
 * Se usa para dos cosas:
 *   · la prueba que vigila la paleta de la marca (`contraste.test.ts`);
 *   · avisar en el panel cuando un tono de producto se va a ver como un
 *     hueco blanco sobre fondo blanco.
 *
 * Fórmula de la especificación, sin librerías: son doce líneas y una
 * dependencia menos que mantener.
 */

/** Luminancia relativa de un color, entre 0 (negro) y 1 (blanco). */
export function luminancia(hex: string): number {
  const limpio = hex.trim().replace(/^#/, "");

  const completo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;

  if (!/^[0-9a-f]{6}$/i.test(completo)) {
    throw new Error(`No es un color hexadecimal: ${hex}`);
  }

  const canales = [0, 2, 4].map((i) => parseInt(completo.slice(i, i + 2), 16) / 255);

  const [r, g, b] = canales.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores: de 1 (iguales) a 21 (negro/blanco). */
export function contraste(colorA: string, colorB: string): number {
  const a = luminancia(colorA);
  const b = luminancia(colorB);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Mínimos de WCAG AA.
 *
 * El texto grande (≥24px, o ≥18.7px en negrita) puede bajar a 3:1 porque
 * los trazos son más gruesos. Todo lo demás necesita 4.5:1.
 */
export const AA_NORMAL = 4.5;
export const AA_GRANDE = 3;

export function cumpleAA(
  texto: string,
  fondo: string,
  tamano: "normal" | "grande" = "normal"
): boolean {
  return contraste(texto, fondo) >= (tamano === "grande" ? AA_GRANDE : AA_NORMAL);
}
