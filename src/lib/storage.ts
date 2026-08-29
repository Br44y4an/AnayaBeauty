const PREFIJO_PUBLICO = "/storage/v1/object/public/";

/**
 * Traduce la URL pública de una imagen a su ruta dentro del bucket, para
 * poder borrarla. Devuelve null si la URL apunta a otro sitio: las imágenes
 * importadas por CSV pueden vivir en cualquier servidor y esas no son
 * nuestras para borrarlas.
 */
export function rutaEnBucket(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;

  const prefijo = `${PREFIJO_PUBLICO}${bucket}/`;
  const corte = url.indexOf(prefijo);
  if (corte === -1) return null;

  const cruda = url.slice(corte + prefijo.length).split("?")[0].split("#")[0];
  if (!cruda) return null;

  try {
    return decodeURIComponent(cruda) || null;
  } catch {
    return cruda;
  }
}
