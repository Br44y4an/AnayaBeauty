import { createHash, timingSafeEqual } from "node:crypto";

const resumen = (texto: string) => createHash("sha256").update(texto).digest();

/** Compara dos secretos en tiempo constante. Nulo o vacío nunca coincide (una clave sin configurar no abre nada). */
export function clavesIguales(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  // Se comparan los resúmenes: miden lo mismo siempre, así el tiempo tampoco delata el largo de la clave.
  return timingSafeEqual(resumen(a), resumen(b));
}
