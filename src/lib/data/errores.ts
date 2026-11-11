/** Nunca devolver vacío en silencio: registra el error de la base y lanza uno legible para `error.tsx`. */
export function falla(origen: string, mensaje: string, error: { message: string }): never {
  console.error(`[${origen}] ${mensaje}:`, error);
  throw new Error(`${mensaje}.`);
}
