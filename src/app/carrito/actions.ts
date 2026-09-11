"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerConfiguracionPublica, obtenerReglasDescuento } from "@/lib/data/catalog";
import { enviarCorreoPedido } from "@/lib/email/send-order";
import type { ReglaDescuento } from "@/lib/discounts";
import type { Escalon } from "@/lib/pricing";

/** Lo mínimo que el carrito necesita saber de cada producto. */
export type ProductoCarrito = {
  id: string;
  referencia: string;
  nombre: string;
  imagenPrincipal: string | null;
  stock: number;
  activo: boolean;
  escalones: Escalon[];
};

export type DatosCarrito = {
  productos: ProductoCarrito[];
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
  pago: { metodo?: string; numero?: string; titular?: string };
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todo lo que el carrito necesita, en una sola ida al servidor.
 *
 * Pasa por `productos_del_carrito`, que es SECURITY DEFINER a propósito:
 * la lectura pública normal solo ve productos con `activo = true`, así
 * que un producto que la administradora ocultó desaparecía del carrito
 * sin dejar ni el nombre, y la clienta veía su bolsa encoger sola.
 */
export async function cargarCarrito(ids: string[]): Promise<DatosCarrito> {
  const limpios = [...new Set(ids)].filter((id) => ES_UUID.test(id));

  // Una sola lectura de la configuración: `obtenerConfiguracionDePrecios`
  // ya la consulta por dentro, así que pedirla aparte la traía dos veces
  // en cada carga del carrito.
  const [reglas, config] = await Promise.all([
    obtenerReglasDescuento(),
    obtenerConfiguracionPublica(),
  ]);

  const umbralPorMayor = Number(config.umbral_por_mayor ?? 200000);
  const pago = {
    metodo: config.pago_metodo,
    numero: config.pago_numero,
    titular: config.pago_titular,
  };

  if (limpios.length === 0) {
    return { productos: [], reglas, umbralPorMayor, pago };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("productos_del_carrito", { p_ids: limpios });

  if (error) throw new Error(`No se pudo cargar tu bolsa: ${error.message}`);

  type Fila = {
    id: string;
    referencia: string;
    nombre: string;
    imagen_principal: string | null;
    stock: number;
    activo: boolean;
    escalones: { min_cantidad: number; precio_unitario: number }[] | null;
  };

  const productos: ProductoCarrito[] = ((data ?? []) as Fila[]).map((f) => ({
    id: f.id,
    referencia: f.referencia,
    nombre: f.nombre,
    imagenPrincipal: f.imagen_principal,
    stock: f.stock,
    activo: f.activo,
    escalones: (f.escalones ?? [])
      .map((e) => ({ minCantidad: e.min_cantidad, precioUnitario: e.precio_unitario }))
      .sort((a, b) => a.minCantidad - b.minCantidad),
  }));

  return { productos, reglas, umbralPorMayor, pago };
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

type CampoConProblema = "nombre" | "whatsapp" | "ciudad" | "bolsa";

/** Traduce los errores de PostgreSQL a algo que la clienta entienda. */
function mensajeAmable(errorCrudo: string): {
  mensaje: string;
  campo?: CampoConProblema;
} {
  if (errorCrudo.includes("DEMASIADOS_PEDIDOS"))
    return {
      mensaje:
        "Ya recibimos varios pedidos desde este dispositivo en los últimos minutos. " +
        "Espera un ratito o escríbenos por WhatsApp y lo tomamos nosotras 💕",
    };

  if (errorCrudo.includes("SIN_STOCK")) {
    const [, nombre, disponible] = errorCrudo.split("|");
    return {
      mensaje: nombre?.trim()
        ? `Se agotó parte de tu pedido: de ${nombre.trim()} solo quedan ${disponible?.trim()}. ` +
          "Ajusta la cantidad en tu bolsa y vuelve a confirmar."
        : "Se agotó parte de tu pedido. Revisa tu bolsa e inténtalo de nuevo.",
      campo: "bolsa",
    };
  }

  if (errorCrudo.includes("PRODUCTO_NO_DISPONIBLE")) {
    const [, nombre] = errorCrudo.split("|");
    return {
      mensaje: nombre?.trim()
        ? `${nombre.trim()} ya no está disponible. Quítalo de tu bolsa para continuar.`
        : "Uno de los productos de tu bolsa ya no está disponible. Revísala, por favor.",
      campo: "bolsa",
    };
  }

  if (errorCrudo.includes("SIN_PRECIO")) {
    const [, nombre] = errorCrudo.split("|");
    return {
      mensaje: `${nombre?.trim() || "Un producto de tu bolsa"} todavía no tiene precio. Escríbenos y te lo cotizamos ✨`,
      campo: "bolsa",
    };
  }

  if (errorCrudo.includes("CARRITO_VACIO"))
    return { mensaje: "Tu bolsa está vacía.", campo: "bolsa" };

  if (errorCrudo.includes("DATOS_INCOMPLETOS"))
    return { mensaje: "Necesitamos tu nombre, WhatsApp y ciudad para poder enviarte." };

  return {
    mensaje:
      "No pudimos crear tu pedido. Inténtalo otra vez en un momento, " +
      "o escríbenos por WhatsApp y lo resolvemos ✨",
  };
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
