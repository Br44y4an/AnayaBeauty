"use server";

import { refresh } from "next/cache";
import { exigirAdmin } from "@/lib/admin/sesion";
import { CLAVES_AJUSTES, validarAjuste } from "@/lib/admin/ajustes";
import type { Resultado } from "@/lib/admin/resultado";
import { invalidarConfig, invalidarPrecios } from "@/lib/data/invalidar";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Solo escribe las claves de `CLAVES_AJUSTES` que vengan en el formulario, y solo si todas son válidas.
 * Todas son públicas: la tienda las lee para el pago, el WhatsApp, el envío y el precio por mayor.
 */
export async function guardarAjustes(datos: FormData): Promise<Resultado> {
  await exigirAdmin();

  const filas: { clave: string; valor: string; publico: true; actualizado_en: string }[] = [];
  const campos: Record<string, string> = {};
  const ahora = new Date().toISOString();

  for (const clave of CLAVES_AJUSTES) {
    const crudo = datos.get(clave);
    if (typeof crudo !== "string") continue;
    const resultado = validarAjuste(clave, crudo);
    if (resultado.ok) filas.push({ clave, valor: resultado.valor, publico: true, actualizado_en: ahora });
    else campos[clave] = resultado.error;
  }

  if (Object.keys(campos).length > 0) return { ok: false, error: "Revisa los campos marcados.", campos };
  if (filas.length === 0) return { ok: false, error: "No llegó ningún ajuste para guardar. Recarga la página." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("store_settings").upsert(filas, { onConflict: "clave" });
  if (error) {
    console.error("[panel] No se pudieron guardar los ajustes:", error);
    return { ok: false, error: `No se pudieron guardar los ajustes. Intenta otra vez. Detalle: ${error.message}` };
  }

  invalidarConfig();
  if (filas.some((f) => f.clave === "umbral_por_mayor")) invalidarPrecios();
  refresh();
  return { ok: true };
}
