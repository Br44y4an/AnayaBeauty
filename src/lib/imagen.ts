/**
 * Validación y nombrado de las imágenes de producto.
 *
 * Va aparte del Server Action para poder probarlo sin tocar Supabase, y
 * porque los mensajes tienen que ser legibles: cuando el action lanzaba, React
 * los borraba en producción y el panel solo mostraba "Minified React error
 * #441", sin decir qué había pasado.
 */

export const MAX_BYTES = 5 * 1024 * 1024;

/** Extensiones que aceptamos conservar; cualquier otra cosa cae a jpg. */
const EXTENSIONES = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"];

type ArchivoSubido = { size: number; name: string } | null | undefined;

/** Devuelve el motivo del rechazo, o null si la imagen sirve. */
export function validarImagen(archivo: ArchivoSubido): string | null {
  if (!archivo || archivo.size === 0) return "No seleccionaste ninguna imagen.";

  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return `La imagen pesa ${mb} MB y el máximo son 5 MB. Usa una más liviana.`;
  }

  return null;
}

/**
 * Ruta dentro del bucket. El nombre original nunca se usa: trae espacios,
 * tildes y hasta barras ("WhatsApp Image 2026-08-31 at 7.21.50 PM.jpeg"), así
 * que solo se conserva la extensión y el resto es un uuid.
 */
export function rutaDeImagen(nombre: string, uuid: string): string {
  const posible = nombre.split(".").pop()?.toLowerCase() ?? "";
  const extension = EXTENSIONES.includes(posible) ? posible : "jpg";
  return `${uuid}.${extension}`;
}
