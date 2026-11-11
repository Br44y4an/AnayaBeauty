/**
 * Validación y nombrado de las fotos de producto, aparte del Server Action para probarlos sin Supabase
 * y devolver mensajes legibles: React borra en producción el mensaje de una excepción.
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

export type TipoImagen = { extension: "jpg" | "png" | "webp"; mime: string };

const empiezaCon = (bytes: Uint8Array, firma: number[], desde = 0) =>
  bytes.length >= desde + firma.length && firma.every((b, i) => bytes[desde + i] === b);

/** El tipo real por los primeros bytes: el nombre y el tipo que manda el navegador no son confiables. */
export function tipoDeImagen(bytes: Uint8Array): TipoImagen | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return { extension: "jpg", mime: "image/jpeg" };
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extension: "png", mime: "image/png" };
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (empiezaCon(bytes, riff) && empiezaCon(bytes, webp, 8)) return { extension: "webp", mime: "image/webp" };
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
