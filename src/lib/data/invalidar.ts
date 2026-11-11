import "server-only";
import { revalidateTag } from "next/cache";
import { ETIQUETA } from "@/lib/data/etiquetas";

// `expire: 0`: quien guarda en el panel tiene que ver su cambio en la
// siguiente visita, no una versión vieja mientras se regenera.

/** Productos, variantes, escalones y categorías. */
export function invalidarCatalogo(): void {
  revalidateTag(ETIQUETA.catalogo, { expire: 0 });
}

/** Reglas de descuento y umbral por mayor. */
export function invalidarPrecios(): void {
  revalidateTag(ETIQUETA.precios, { expire: 0 });
}

/** Ajustes públicos de la tienda. */
export function invalidarConfig(): void {
  revalidateTag(ETIQUETA.config, { expire: 0 });
}
