/** Se usa si el ajuste `whatsapp_negocio` falta o no es válido. */
export const WHATSAPP_RESPALDO = "573228813646";

/** «300 123 4567» o «+57 300-123-4567» → «573001234567»; cualquier otra cosa, null. */
export function normalizarWhatsapp(v: string): string | null {
  const digitos = v.replace(/\D/g, "");
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  if (/^57\d{10}$/.test(digitos)) return digitos;
  return null;
}

export function enlaceWhatsApp(mensaje: string, numero?: string | null): string {
  const destino = (numero && normalizarWhatsapp(numero)) || WHATSAPP_RESPALDO;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`;
}
