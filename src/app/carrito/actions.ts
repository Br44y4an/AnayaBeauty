"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { obtenerDatosBolsa } from "@/lib/data/bolsa";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { mensajeAmable, type CampoConProblema } from "@/lib/carrito/mensajes";
import { enviarCorreoPedido } from "@/lib/email/send-order";
import type { ConfiguracionPublica, DatosBolsa } from "@/lib/types";

export type DatosCarrito = DatosBolsa & { pago: ConfiguracionPublica["pago"] };

/** Todo lo que el carrito necesita, en una sola ida al servidor. */
export async function cargarCarrito(ids: string[]): Promise<DatosCarrito> {
  const [datos, config] = await Promise.all([obtenerDatosBolsa(ids), obtenerConfiguracionPublica()]);
  return { ...datos, pago: config.pago };
}

/* =====================================================================
   Confirmación del pedido
   ===================================================================== */

export type ResultadoConfirmacion =
  | { ok: true; pedidoId: string; numeroPedido: string }
  | { ok: false; mensaje: string; campo?: CampoConProblema };

/** Hash con sal de la IP: permite limitar abusos sin guardar la IP. */
async function hashDelDispositivo(): Promise<string> {
  const cabeceras = await headers();
  const ip =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabeceras.get("x-real-ip") ??
    "desconocida";

  return createHash("sha256")
    .update(ip + (process.env.SAL_HASH_IP ?? ""))
    .digest("hex");
}

/** Deja el WhatsApp en solo dígitos para poder validarlo y escribirle luego. */
function digitosDe(texto: string): string {
  return texto.replace(/\D/g, "");
}

export async function confirmarPedido(
  _estadoPrevio: ResultadoConfirmacion | null,
  datos: FormData
): Promise<ResultadoConfirmacion> {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const whatsapp = String(datos.get("whatsapp") ?? "").trim();
  const ciudad = String(datos.get("ciudad") ?? "").trim();
  const notas = String(datos.get("notas") ?? "").trim().slice(0, 400);
  const clave = String(datos.get("clave") ?? "").trim().slice(0, 64);

  let items: { producto_id: string; cantidad: number; tono?: string | null }[];
  try {
    items = JSON.parse(String(datos.get("items") ?? "[]"));
  } catch {
    return {
      ok: false,
      mensaje: "Hubo un problema con tu bolsa. Recarga la página y vuelve a intentarlo.",
      campo: "bolsa",
    };
  }

  if (!nombre) return { ok: false, mensaje: "Escribe tu nombre completo.", campo: "nombre" };

  const soloDigitos = digitosDe(whatsapp);
  if (soloDigitos.length < 7 || soloDigitos.length > 15) {
    return {
      ok: false,
      mensaje: "Revisa tu WhatsApp: escríbelo con indicativo, por ejemplo 300 123 4567.",
      campo: "whatsapp",
    };
  }

  if (!ciudad) return { ok: false, mensaje: "Dinos a qué ciudad enviamos.", campo: "ciudad" };

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, mensaje: "Tu bolsa está vacía.", campo: "bolsa" };
  }

  const supabase = clienteAdmin();

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_nombre: nombre,
    p_whatsapp: whatsapp,
    p_ciudad: ciudad,
    p_notas: notas || null,
    p_items: items,
    p_ip_hash: await hashDelDispositivo(),
    p_clave: clave || null,
  });

  if (error) {
    const { mensaje, campo } = mensajeAmable(error.message);
    return { ok: false, mensaje, campo };
  }

  // Defensa por si la función devolviera algo inesperado: sin esto, un
  // `data` nulo reventaba aquí y llegaba al navegador como el críptico
  // "Minified React error #441", con el mensaje real borrado por React.
  const pedidoId = data?.order_id as string | undefined;
  const numeroPedido = data?.numero_pedido as string | undefined;

  if (!pedidoId || !numeroPedido) {
    console.error("[pedido] crear_pedido devolvió una respuesta inesperada:", data);
    return {
      ok: false,
      mensaje:
        "Algo raro pasó al guardar tu pedido. Escríbenos por WhatsApp antes de " +
        "volver a intentarlo, para no cobrarte dos veces.",
    };
  }

  // Un reintento del mismo envío devuelve el pedido que ya existía: no
  // hay que volver a avisar por correo de algo ya avisado.
  if (data?.repetido === true) {
    return { ok: true, pedidoId, numeroPedido };
  }

  // El correo va después de que la transacción confirmó. Si falla, el
  // pedido ya está guardado; `enviarCorreoPedido` nunca lanza.
  const { data: lineas } = await supabase
    .from("order_items")
    .select("referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad, subtotal")
    .eq("order_id", pedidoId);

  await enviarCorreoPedido({
    numeroPedido,
    nombre,
    whatsapp,
    ciudad,
    notas: notas || null,
    subtotal: (data.subtotal ?? data.total) as number,
    descuento: (data.descuento ?? 0) as number,
    porcentaje: (data.porcentaje ?? 0) as number,
    porMayor: (data.por_mayor ?? false) as boolean,
    total: data.total as number,
    lineas: (lineas ?? []).map((l) => ({
      referencia: l.referencia_snapshot,
      nombre: l.nombre_snapshot,
      tono: l.tono_snapshot ?? null,
      cantidad: l.cantidad,
      subtotal: l.subtotal,
    })),
  });

  return { ok: true, pedidoId, numeroPedido };
}
