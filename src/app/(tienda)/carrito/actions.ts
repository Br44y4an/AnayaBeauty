"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { obtenerDatosBolsa } from "@/lib/data/bolsa";
import { ETIQUETA } from "@/lib/data/etiquetas";
import { mensajeAmable, type CampoConProblema } from "@/lib/carrito/mensajes";
import { enviarCorreoPedido } from "@/lib/email/send-order";
import { VERSION_POLITICA } from "@/lib/legal";
import { esUuid } from "@/lib/ids";

export type ResultadoConfirmacion =
  | { ok: true; id: string; numero: string; total: number }
  | { ok: false; mensaje: string; campo?: CampoConProblema; codigo?: string };

type Fallo = Extract<ResultadoConfirmacion, { ok: false }>;
type Item = { producto_id: string; cantidad: number; tono: string | null };

const MAX_NOMBRE = 80;
const MAX_CIUDAD = 60;
const MAX_NOTA = 300;
const MAX_LINEAS = 40;
const MAX_POR_LINEA = 50;
const MAX_UNIDADES = 150;
const NUMERO_PEDIDO = /^AB-\d{4,8}$/;

const BOLSA_ILEGIBLE: Fallo = {
  ok: false,
  campo: "bolsa",
  mensaje: "Hubo un problema con tu bolsa. Recarga la página e intenta de nuevo.",
};

const texto = (datos: FormData, clave: string) => String(datos.get(clave) ?? "").trim();

/** Acepta el código suelto o el mensaje crudo de la base («SIN_STOCK|Brillo|2»). */
function fallo(crudo: string, detalle?: string): Fallo {
  const codigo = crudo.split("|")[0].trim();
  return { ok: false, ...mensajeAmable(crudo, detalle), ...(/^[A-Z_]+$/.test(codigo) ? { codigo } : {}) };
}

function validarCliente(nombre: string, whatsapp: string, ciudad: string, notas: string): Fallo | null {
  if (!nombre) return { ok: false, campo: "nombre", mensaje: "Escribe tu nombre y apellido." };
  if (nombre.length > MAX_NOMBRE) {
    return { ok: false, campo: "nombre", mensaje: `Escribe tu nombre en ${MAX_NOMBRE} caracteres o menos.` };
  }
  const digitos = whatsapp.replace(/\D/g, "").length;
  if (digitos < 7 || digitos > 15) {
    return { ok: false, campo: "whatsapp", mensaje: "Revisa tu número de WhatsApp. Ej.: 300 123 4567." };
  }
  if (!ciudad) return { ok: false, campo: "ciudad", mensaje: "Escribe tu ciudad o municipio." };
  if (ciudad.length > MAX_CIUDAD) {
    return { ok: false, campo: "ciudad", mensaje: `Escribe la ciudad en ${MAX_CIUDAD} caracteres o menos.` };
  }
  if (notas.length > MAX_NOTA) return { ok: false, mensaje: `Acorta la nota a ${MAX_NOTA} caracteres.` };
  return null;
}

function leerItems(crudo: string): Item[] | null {
  let lista: unknown;
  try {
    lista = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!Array.isArray(lista)) return null;

  const items = lista.map((x: Partial<Item> | null) => ({
    producto_id: x?.producto_id,
    cantidad: x?.cantidad,
    tono: x?.tono ?? null,
  }));
  const validos = items.every(
    (i) =>
      esUuid(i.producto_id) &&
      Number.isInteger(i.cantidad) &&
      (i.cantidad as number) >= 1 &&
      (i.tono === null || (typeof i.tono === "string" && i.tono.length <= 120))
  );
  return validos ? (items as Item[]) : null;
}

function esMuyGrande(items: Item[]): boolean {
  const unidades = items.reduce((suma, i) => suma + i.cantidad, 0);
  return items.length > MAX_LINEAS || unidades > MAX_UNIDADES || items.some((i) => i.cantidad > MAX_POR_LINEA);
}

/** `crear_pedido` no conoce las variantes: aquí se exige una vigente y sin agotar. */
async function validarVariantes(items: Item[]): Promise<Fallo | null> {
  const { productos } = await obtenerDatosBolsa([...new Set(items.map((i) => i.producto_id))]);
  for (const item of items) {
    const producto = productos.find((p) => p.id === item.producto_id);
    if (!producto || producto.variantes.length === 0) continue;

    const variante = producto.variantes.find((v) => v.nombre === item.tono?.trim());
    if (!variante || variante.agotado) return fallo("TONO_NO_DISPONIBLE", producto.nombre);
  }
  return null;
}

/** Hash con sal de la IP: permite limitar abusos sin guardar la IP. */
function hashDelDispositivo(cabeceras: Headers): string {
  const ip =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || "desconocida";
  return createHash("sha256")
    .update(ip + (process.env.SAL_HASH_IP ?? ""))
    .digest("hex");
}

export async function confirmarPedido(
  _previo: ResultadoConfirmacion | null,
  datos: FormData
): Promise<ResultadoConfirmacion> {
  const nombre = texto(datos, "nombre");
  const whatsapp = texto(datos, "whatsapp");
  const ciudad = texto(datos, "ciudad");
  const notas = texto(datos, "notas");
  const clave = texto(datos, "clave").slice(0, 64);
  const adicional = texto(datos, "adicional");

  const problema = validarCliente(nombre, whatsapp, ciudad, notas);
  if (problema) return problema;

  const items = leerItems(String(datos.get("items") ?? ""));
  if (!items) return BOLSA_ILEGIBLE;
  if (items.length === 0) return fallo("CARRITO_VACIO");
  if (esMuyGrande(items)) return fallo("PEDIDO_MUY_GRANDE");

  try {
    const variantes = await validarVariantes(items);
    if (variantes) return variantes;
  } catch (error) {
    console.error("[pedido] no se pudieron validar las variantes:", error);
    return fallo("");
  }

  const cabeceras = await headers();
  const prefijo = NUMERO_PEDIDO.test(adicional) ? `[Adicional a ${adicional}] ` : "";
  const supabase = clienteAdmin();

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_nombre: nombre,
    p_whatsapp: whatsapp,
    p_ciudad: ciudad,
    p_notas: `${prefijo}${notas}`.trim() || null,
    p_items: items,
    p_ip_hash: hashDelDispositivo(cabeceras),
    p_clave: clave || null,
  });

  if (error) return fallo(error.message);

  const id: unknown = data?.order_id;
  const numero: unknown = data?.numero_pedido;
  const total = Number(data?.total);
  if (typeof id !== "string" || typeof numero !== "string" || !Number.isFinite(total)) {
    console.error("[pedido] crear_pedido devolvió una respuesta inesperada:", data);
    return {
      ok: false,
      mensaje:
        "No pudimos comprobar si tu pedido quedó guardado. Escríbenos por WhatsApp antes de intentar de nuevo, para no duplicarlo.",
    };
  }

  // Solo la primera vez (`is null`): un reintento no cambia cuándo se aceptó la política.
  const politica = await supabase
    .from("orders")
    .update({ politica_version: VERSION_POLITICA, politica_aceptada_en: new Date().toISOString() })
    .eq("id", id)
    .is("politica_version", null);
  if (politica.error) console.error(`[pedido] no se registró la política de ${numero}:`, politica.error);

  // Un reintento del mismo envío devuelve el pedido que ya existía: nada que invalidar ni avisar.
  if (data.repetido === true) return { ok: true, id, numero, total };

  revalidateTag(ETIQUETA.catalogo, "max");

  const sitio = cabeceras.get("origin");
  after(async () => {
    const { data: lineas } = await supabase
      .from("order_items")
      .select("referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad, subtotal")
      .eq("order_id", id);

    await enviarCorreoPedido({
      numeroPedido: numero,
      nombre,
      whatsapp,
      ciudad,
      notas: `${prefijo}${notas}`.trim() || null,
      subtotal: Number(data.subtotal ?? total),
      descuento: Number(data.descuento ?? 0),
      porcentaje: Number(data.porcentaje ?? 0),
      porMayor: data.por_mayor === true,
      total,
      sitio,
      lineas: (lineas ?? []).map((l) => ({
        referencia: l.referencia_snapshot,
        nombre: l.nombre_snapshot,
        tono: l.tono_snapshot ?? null,
        cantidad: l.cantidad,
        subtotal: l.subtotal,
      })),
    });
  });

  return { ok: true, id, numero, total };
}
