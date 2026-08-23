"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Qué claves son visibles para las clientas en la web. */
const PUBLICAS = new Set([
  "pago_metodo",
  "pago_titular",
  "pago_numero",
  "whatsapp_negocio",
  "mensaje_exito",
]);

export async function guardarConfiguracion(datos: FormData) {
  const supabase = await crearClienteServidor();

  const filas = [...datos.entries()]
    .filter(([clave]) => clave !== "$ACTION_ID")
    .map(([clave, valor]) => ({
      clave,
      valor: String(valor),
      publico: PUBLICAS.has(clave),
      actualizado_en: new Date().toISOString(),
    }));

  if (filas.length === 0) return;

  const { error } = await supabase
    .from("store_settings")
    .upsert(filas, { onConflict: "clave" });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}
