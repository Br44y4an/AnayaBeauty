"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { enviarCorreoPedido } from "@/lib/email/send-order";

export type ResultadoConfirmacion =
  | { ok: true; pedidoId: string; numeroPedido: string }
  | { ok: false; mensaje: string };

/** Hash con sal de la IP: permite limitar intentos sin guardar la IP. */
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

/** Traduce los errores de PostgreSQL a mensajes que la clienta entiende. */
function mensajeAmable(errorCrudo: string): string {
  if (errorCrudo.includes("DEMASIADOS_INTENTOS"))
    return "Demasiados intentos seguidos. Espera 10 minutos e inténtalo otra vez 💕";

  if (errorCrudo.includes("CODIGO_VENCIDO"))
    return "Tu código ya venció. Pídenos uno nuevo por WhatsApp 💕";

  if (errorCrudo.includes("CODIGO_INVALIDO"))
    return "Ese código no es válido o ya fue usado. Escríbenos por WhatsApp y te ayudamos ✨";

  if (errorCrudo.includes("SIN_STOCK")) {
    const partes = errorCrudo.split("|");
    const nombre = partes[1]?.trim();
    const disponible = partes[2]?.trim();
    return nombre
      ? `Se agotó parte de tu pedido: de ${nombre} solo quedan ${disponible}. Ajusta tu bolsa e inténtalo de nuevo.`
      : "Se agotó parte de tu pedido. Revisa tu bolsa e inténtalo de nuevo.";
  }

  if (errorCrudo.includes("PRODUCTO_NO_DISPONIBLE"))
    return "Uno de los productos de tu bolsa ya no está disponible. Revísala, por favor 💔";

  if (errorCrudo.includes("CARRITO_VACIO")) return "Tu bolsa está vacía.";

  if (errorCrudo.includes("DATOS_INCOMPLETOS"))
    return "Necesitamos tu nombre, WhatsApp y ciudad para poder enviarte.";

  return "No pudimos crear tu pedido. Escríbenos por WhatsApp y lo resolvemos ✨";
}

export async function confirmarPedido(
  _estadoPrevio: ResultadoConfirmacion | null,
  datos: FormData
): Promise<ResultadoConfirmacion> {
  const codigo = String(datos.get("codigo") ?? "").replace(/\D/g, "").slice(0, 4);
  const nombre = String(datos.get("nombre") ?? "").trim();
  const whatsapp = String(datos.get("whatsapp") ?? "").trim();
  const ciudad = String(datos.get("ciudad") ?? "").trim();

  let items: { producto_id: string; cantidad: number; tono?: string | null }[];
  try {
    items = JSON.parse(String(datos.get("items") ?? "[]"));
  } catch {
    return { ok: false, mensaje: "Hubo un problema con tu bolsa. Vuelve a armarla." };
  }

  if (codigo.length !== 4)
    return { ok: false, mensaje: "El código debe tener 4 dígitos." };
  if (!nombre || !whatsapp || !ciudad)
    return { ok: false, mensaje: "Completa tu nombre, WhatsApp y ciudad." };
  if (items.length === 0) return { ok: false, mensaje: "Tu bolsa está vacía." };

  const supabase = clienteAdmin();

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_codigo: codigo,
    p_nombre: nombre,
    p_whatsapp: whatsapp,
    p_ciudad: ciudad,
    p_items: items,
    p_ip_hash: await hashDelDispositivo(),
  });

  if (error) return { ok: false, mensaje: mensajeAmable(error.message) };

  const pedidoId = data.order_id as string;
  const numeroPedido = data.numero_pedido as string;

  // El correo va después de que la transacción confirmó. Si falla, el
  // pedido ya está guardado; enviarCorreoPedido nunca lanza.
  const { data: lineas } = await supabase
    .from("order_items")
    .select("referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad, subtotal")
    .eq("order_id", pedidoId);

  await enviarCorreoPedido({
    numeroPedido,
    nombre,
    whatsapp,
    ciudad,
    codigo,
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
