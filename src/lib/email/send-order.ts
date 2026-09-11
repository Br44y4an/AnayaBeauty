import "server-only";
import { Resend } from "resend";
import { plantillaCorreoPedido, type DatosCorreo } from "./order-template";
import { pesos } from "@/lib/format";

/** Qué pasó con el aviso. Permite que quien llama diga la verdad. */
export type ResultadoCorreo =
  | { ok: true; id: string | null }
  | { ok: false; motivo: string };

/**
 * Envía el aviso de pedido nuevo a la administradora.
 *
 * Nunca lanza: si el correo falla, el pedido ya está guardado y visible en
 * el panel. Perder el aviso es molesto; perder la venta sería grave.
 *
 * Pero sí **informa**: el SDK de Resend no lanza cuando la API rechaza el
 * envío, devuelve `{ data: null, error }`. Antes eso se perdía en silencio
 * (el try/catch solo atrapaba fallos de red), así que un rechazo 403 —el
 * caso normal mientras no haya un dominio verificado y se envíe a una
 * dirección distinta de la dueña de la cuenta— dejaba a la administradora
 * sin avisos y sin ninguna señal de por qué.
 */
export async function enviarCorreoPedido(datos: DatosCorreo): Promise<ResultadoCorreo> {
  const clave = process.env.RESEND_API_KEY;
  const destino = process.env.CORREO_DESTINO;

  if (!clave || !destino) {
    const motivo = `falta ${!clave ? "RESEND_API_KEY" : "CORREO_DESTINO"}`;
    console.error(`[correo] ${motivo}; el pedido SÍ se guardó`);
    return { ok: false, motivo };
  }

  try {
    const resend = new Resend(clave);
    const { data, error } = await resend.emails.send({
      from: "Anaya Beauty <onboarding@resend.dev>",
      to: destino,
      subject: `Pedido ${datos.numeroPedido} — ${datos.nombre} — ${pesos(datos.total)}`,
      html: plantillaCorreoPedido(datos),
    });

    if (error) {
      const motivo = `${error.name ?? "error"}: ${error.message}`;
      console.error(
        `[correo] Resend rechazó el aviso del pedido ${datos.numeroPedido} — ${motivo}`
      );
      return { ok: false, motivo };
    }

    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "error desconocido";
    console.error(
      `[correo] no se pudo enviar el aviso del pedido ${datos.numeroPedido} — ${motivo}`
    );
    return { ok: false, motivo };
  }
}
