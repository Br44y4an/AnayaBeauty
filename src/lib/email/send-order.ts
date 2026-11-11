import "server-only";
import { Resend } from "resend";
import { plantillaCorreoPedido, type DatosCorreo } from "./order-template";
import { pesos } from "@/lib/format";

/** Qué pasó con el aviso. Permite que quien llama diga la verdad. */
export type ResultadoCorreo =
  | { ok: true; id: string | null }
  | { ok: false; motivo: string };

// Avisa a la administradora del pedido nuevo. Nunca lanza (el pedido ya está guardado), pero informa:
// Resend no lanza cuando la API rechaza el envío, devuelve `{ data: null, error }`.
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
      subject: `Pedido ${datos.numeroPedido} · ${datos.nombre} · ${pesos(datos.total)}`,
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
