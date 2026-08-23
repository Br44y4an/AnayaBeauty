import "server-only";
import { Resend } from "resend";
import { plantillaCorreoPedido, type DatosCorreo } from "./order-template";
import { pesos } from "@/lib/format";

/**
 * Envía el aviso de pedido nuevo a la administradora.
 *
 * Nunca lanza: si el correo falla, el pedido ya está guardado y visible en
 * el panel. Perder el aviso es molesto; perder la venta sería grave.
 */
export async function enviarCorreoPedido(datos: DatosCorreo): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  const destino = process.env.CORREO_DESTINO;

  if (!clave || !destino) {
    console.error("[correo] falta RESEND_API_KEY o CORREO_DESTINO; el pedido SÍ se guardó");
    return;
  }

  try {
    const resend = new Resend(clave);
    await resend.emails.send({
      from: "Anaya Beauty <onboarding@resend.dev>",
      to: destino,
      subject: `Pedido ${datos.numeroPedido} — ${datos.nombre} — ${pesos(datos.total)}`,
      html: plantillaCorreoPedido(datos),
    });
  } catch (error) {
    console.error("[correo] no se pudo enviar el aviso del pedido", error);
  }
}
