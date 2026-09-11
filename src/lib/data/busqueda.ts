/**
 * Filtro de búsqueda para PostgREST.
 *
 * Hay DOS trampas distintas en la misma cadena y las dos han roto el
 * buscador alguna vez:
 *
 * 1. LA COMA. En `or(...)` la coma separa las condiciones, así que un
 *    término como "base, matte" partía el filtro en pedazos inválidos:
 *    PostgREST respondía "failed to parse logic tree", la consulta
 *    lanzaba y la página entera moría con un 500 (que en el navegador se
 *    ve como "Minified React error #441"). Se resuelve entrecomillando
 *    el valor; dentro de las comillas solo hay que escapar la barra
 *    invertida y la comilla doble.
 *
 * 2. LOS COMODINES DE LIKE. `%` y `_` son comodines para `ilike`, no
 *    texto. Buscar "50%" devolvía cualquier cosa que empezara por "50",
 *    y "A_1" traía "A11", "AB1"… La clienta escribe un guion bajo porque
 *    está en la referencia, no porque quiera un comodín.
 */

const COLUMNAS_POR_DEFECTO = ["nombre", "referencia"];

/** Escapa lo que en `ilike` significa "cualquier cosa". */
function escaparComodines(texto: string): string {
  // La barra invertida va primero: si no, escaparía las barras que
  // añaden los reemplazos siguientes.
  return texto
    .split("\\")
    .join("\\\\")
    .split("%")
    .join("\\%")
    .split("_")
    .join("\\_");
}

/** Escapa lo que rompería las comillas del valor de PostgREST. */
function escaparComillas(texto: string): string {
  return texto.split('"').join('\\"');
}

/** Arma el argumento de `.or()` buscando `texto` en cada columna. */
export function filtroBusqueda(
  texto: string,
  columnas: string[] = COLUMNAS_POR_DEFECTO
): string {
  const patron = escaparComillas(`%${escaparComodines(texto.trim())}%`);
  return columnas.map((columna) => `${columna}.ilike."${patron}"`).join(",");
}
