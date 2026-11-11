import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Primera línea de toda página, lectura y acción del panel: sesión y fila en `administradores`.
 * Falla cerrado (si no se puede comprobar el rol, no deja pasar). Una vez por petición.
 */
export const exigirAdmin = cache(async (): Promise<{ userId: string }> => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: esAdmin, error } = await supabase.rpc("es_admin");
  if (error || esAdmin !== true) redirect("/admin/login");

  return { userId: user.id };
});
