import { PALETA } from "@/lib/marca";

/** Las fotos del celular pesan de 2 a 6 MB: se reducen aquí antes de enviarlas al servidor. */

const LADO_MAXIMO = 1600;
const CALIDAD = 0.85;

/** Medidas finales: el lado mayor queda en `ladoMaximo` como mucho; nunca se agranda. */
export function medidasComprimidas(
  ancho: number,
  alto: number,
  ladoMaximo: number
): { ancho: number; alto: number } {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}

/**
 * JPEG reducido y sin metadatos (también sin la ubicación GPS de la cámara). El fondo va en blanco
 * porque JPEG no tiene transparencia: un PNG recortado quedaría con el fondo negro.
 */
export async function comprimirImagen(
  archivo: File,
  ladoMaximo = LADO_MAXIMO,
  calidad = CALIDAD
): Promise<Blob> {
  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No pudimos leer esa foto. Prueba con otra en JPG o PNG.");
  }

  try {
    const { ancho, alto } = medidasComprimidas(mapa.width, mapa.height, ladoMaximo);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;

    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("Este navegador no puede preparar la foto. Prueba desde otro.");
    contexto.imageSmoothingQuality = "high";
    contexto.fillStyle = PALETA.fondo;
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(mapa, 0, 0, ancho, alto);

    return await new Promise<Blob>((resolver, rechazar) =>
      lienzo.toBlob(
        (blob) => (blob ? resolver(blob) : rechazar(new Error("No pudimos preparar la foto. Intenta otra vez."))),
        "image/jpeg",
        calidad
      )
    );
  } finally {
    mapa.close();
  }
}
