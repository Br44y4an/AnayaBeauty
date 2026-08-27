export const WHATSAPP_NEGOCIO = "573228813646";

const formateador = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

/** Formatea un valor en pesos colombianos: 27000 → "$27.000" */
export function pesos(valor: number): string {
  return `$${formateador.format(Math.round(valor))}`;
}

/** Enlace directo al WhatsApp del negocio con un mensaje preescrito. */
export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(mensaje)}`;
}
