/**
 * Copia de los tokens de color de globals.css para lo que no lee CSS: el
 * correo, el PDF y global-error. `marca.test.ts` vigila que coincidan.
 */
export const PALETA = {
  fondo: "#ffffff",
  superficie: "#f7f3f5",
  tinta: "#261c22",
  tintaSuave: "#6d5765",
  linea: "#ebe4e8",
  acento: "#d11a72",
  acentoHondo: "#a8145a",
  firma: "#8956b8",
  ahorro: "#0f7a52",
  error: "#b42318",
} as const;
