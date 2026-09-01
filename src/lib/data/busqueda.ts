/**
 * Filtro de búsqueda para PostgREST.
 *
 * En `or(...)` la coma separa las condiciones, así que un término con coma
 * ("base, matte") partía el filtro en pedazos inválidos: PostgREST respondía
 * "failed to parse logic tree", la consulta lanzaba y la página entera moría
 * con un 500 (que en el navegador se ve como "Minified React error #441").
 *
 * PostgREST permite entrecomillar el valor para protegerlo; dentro de las
 * comillas solo hay que escapar la barra invertida y la comilla doble.
 */

const COLUMNAS_POR_DEFECTO = ["nombre", "referencia"];

/** Arma el argumento de `.or()` buscando `texto` en cada columna. */
export function filtroBusqueda(
  texto: string,
  columnas: string[] = COLUMNAS_POR_DEFECTO
): string {
  // La barra invertida se escapa primero: si no, escaparía las comillas que
  // añadimos después y volvería a romper el filtro.
  const patron = `%${texto.trim()}%`
    .split("\\")
    .join("\\\\")
    .split('"')
    .join('\\"');

  return columnas.map((columna) => `${columna}.ilike."${patron}"`).join(",");
}
