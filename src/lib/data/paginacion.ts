/**
 * Paginación para las consultas que deben devolver la tabla completa.
 *
 * PostgREST recorta toda respuesta a su `max-rows` (1000 en Supabase), así que
 * una sola consulta nunca es fiable para una tabla que crece: las filas
 * sobrantes se pierden en silencio, sin error. Antes el catálogo pedía
 * `.limit(500)` fijo y con 591 productos cargados se caían 76 del buscador de
 * recibos manuales sin ningún aviso.
 */

export const TAMANO_PAGINA = 1000;

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Llama a `consultar(desde, hasta)` en páginas sucesivas hasta agotar la tabla.
 * `consultar` debe traer las filas siempre en el mismo orden, o las páginas se
 * solapan.
 */
export async function traerTodas<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>
): Promise<T[]> {
  const todas: T[] = [];

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await consultar(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(error.message);

    const pagina = data ?? [];
    todas.push(...pagina);

    // Una página incompleta significa que ya no queda nada detrás. Cortar aquí
    // también evita el bucle infinito si el servidor devuelve vacío.
    if (pagina.length < TAMANO_PAGINA) return todas;
  }
}
