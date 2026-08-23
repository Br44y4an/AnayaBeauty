"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function generarCodigoNuevo(nota?: string) {
  // Se usa el cliente de sesión, no el de servicio: generar_codigo exige
  // auth.uid() para registrar quién creó el código.
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.rpc("generar_codigo", { p_nota: nota ?? null });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/codigos");
  return { code: data.code as string, venceEn: data.vence_en as string };
}

export async function anularCodigo(id: string) {
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("access_codes")
    .update({ estado: "anulado" })
    .eq("id", id)
    .eq("estado", "disponible");

  if (error) throw new Error(error.message);
  revalidatePath("/admin/codigos");
}
