import "server-only";
import { unstable_cache } from "next/cache";
import { clientePublico } from "@/lib/supabase/publico";
import { falla } from "@/lib/data/errores";
import { ETIQUETA, VERSION_DATOS } from "@/lib/data/etiquetas";
import { normalizarWhatsapp, WHATSAPP_RESPALDO } from "@/lib/whatsapp";
import type { ReglaDescuento } from "@/lib/discounts";
import type { ConfiguracionPublica } from "@/lib/types";

const UMBRAL_POR_DEFECTO = 200000;
export const ENVIO_POR_DEFECTO = "El envío se coordina por WhatsApp después de confirmar tu pedido.";

type FilaAjuste = { clave: string; valor: string | null };

/** Un ajuste vacío o ausente nunca llega a la pantalla como «undefined». */
export function mapearConfiguracion(filas: FilaAjuste[]): ConfiguracionPublica {
  const valores = new Map(filas.map((f) => [f.clave, f.valor?.trim() || null]));
  const texto = (clave: string) => valores.get(clave) ?? null;
  const umbral = texto("umbral_por_mayor");

  return {
    mensajeExito: texto("mensaje_exito"),
    umbralPorMayor: umbral && /^\d+$/.test(umbral) ? Number(umbral) : UMBRAL_POR_DEFECTO,
    whatsappNegocio: normalizarWhatsapp(texto("whatsapp_negocio") ?? "") ?? WHATSAPP_RESPALDO,
    envioInfo: texto("envio_info") ?? ENVIO_POR_DEFECTO,
    pago: {
      metodo: texto("pago_metodo"),
      numero: texto("pago_numero"),
      titular: texto("pago_titular"),
    },
  };
}

async function leerAjustes(): Promise<FilaAjuste[]> {
  const { data, error } = await clientePublico()
    .from("store_settings")
    .select("clave, valor")
    .eq("publico", true)
    .overrideTypes<FilaAjuste[], { merge: false }>();

  if (error) falla("config", "No se pudo cargar la configuración", error);
  return data ?? [];
}

async function leerReglas(): Promise<ReglaDescuento[]> {
  const { data, error } = await clientePublico()
    .from("discount_rules")
    .select("monto_minimo, porcentaje")
    .eq("activo", true)
    .order("monto_minimo", { ascending: false })
    .overrideTypes<{ monto_minimo: number; porcentaje: number }[], { merge: false }>();

  if (error) falla("config", "No se pudieron cargar las reglas de descuento", error);
  return (data ?? []).map((r) => ({ montoMinimo: r.monto_minimo, porcentaje: r.porcentaje }));
}

export const obtenerConfiguracionPublica: () => Promise<ConfiguracionPublica> = unstable_cache(
  async () => mapearConfiguracion(await leerAjustes()),
  ["configuracion", VERSION_DATOS],
  { tags: [ETIQUETA.config], revalidate: 300 }
);

/** Lleva también la etiqueta de config: el umbral por mayor es un ajuste. */
export const obtenerConfiguracionDePrecios: () => Promise<{
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
}> = unstable_cache(
  async () => {
    const [reglas, ajustes] = await Promise.all([leerReglas(), leerAjustes()]);
    return { reglas, umbralPorMayor: mapearConfiguracion(ajustes).umbralPorMayor };
  },
  ["precios", VERSION_DATOS],
  { tags: [ETIQUETA.precios, ETIQUETA.config], revalidate: 300 }
);
