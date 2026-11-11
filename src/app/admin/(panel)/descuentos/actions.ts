"use server";

import { refresh } from "next/cache";
import { exigirAdmin } from "@/lib/admin/sesion";
import { validarReglaDescuento } from "@/lib/admin/ajustes";
import type { Resultado } from "@/lib/admin/resultado";
import { invalidarPrecios } from "@/lib/data/invalidar";
import { pesos } from "@/lib/format";
import { esUuid } from "@/lib/ids";
import { crearClienteServidor } from "@/lib/supabase/server";

// El umbral del precio por mayor es un ajuste: se guarda con `guardarAjustes` de Ajustes.

function falloDeBase(mensaje: string, error: { message: string }): { ok: false; error: string } {
  console.error(`[panel] ${mensaje}:`, error);
  return { ok: false, error: `${mensaje}. Intenta otra vez. Detalle: ${error.message}` };
}

function despuesDeEscribir() {
  invalidarPrecios();
  refresh();
}

/** Una regla por monto: si ya hay una desde ese monto, se le cambia el porcentaje y se activa. */
export async function guardarReglaDescuento(datos: FormData): Promise<Resultado<{ mensaje: string }>> {
  await exigirAdmin();
  const regla = validarReglaDescuento(String(datos.get("monto_minimo") ?? ""), String(datos.get("porcentaje") ?? ""));
  if (!regla.ok) return regla;

  const supabase = await crearClienteServidor();
  const { data: previa, error: errorLectura } = await supabase
    .from("discount_rules")
    .select("id")
    .eq("monto_minimo", regla.montoMinimo)
    .maybeSingle();
  if (errorLectura) return falloDeBase("No se pudo revisar el descuento", errorLectura);

  const { error } = await supabase
    .from("discount_rules")
    .upsert(
      { monto_minimo: regla.montoMinimo, porcentaje: regla.porcentaje, activo: true },
      { onConflict: "monto_minimo" }
    );
  if (error) return falloDeBase("No se pudo guardar el descuento", error);

  despuesDeEscribir();
  const desde = pesos(regla.montoMinimo);
  return {
    ok: true,
    mensaje: previa
      ? `Cambiaste el descuento desde ${desde}: ahora es del ${regla.porcentaje}\u00a0%.`
      : `Agregaste ${regla.porcentaje}\u00a0% de descuento desde ${desde}.`,
  };
}

export async function cambiarReglaDescuento(id: string, activo: boolean): Promise<Resultado> {
  await exigirAdmin();
  if (!esUuid(id)) return { ok: false, error: "Este descuento no es válido." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("discount_rules")
    .update({ activo: activo === true })
    .eq("id", id)
    .select("id");
  if (error) return falloDeBase("No se pudo cambiar el descuento", error);
  if (!data?.length) return { ok: false, error: "Este descuento ya no existe. Recarga la página." };

  despuesDeEscribir();
  return { ok: true };
}

export async function eliminarReglaDescuento(id: string): Promise<Resultado> {
  await exigirAdmin();
  if (!esUuid(id)) return { ok: false, error: "Este descuento no es válido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("discount_rules").delete().eq("id", id);
  if (error) return falloDeBase("No se pudo eliminar el descuento", error);

  despuesDeEscribir();
  return { ok: true };
}
