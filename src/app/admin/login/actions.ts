"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoLogin = { error: string; correo: string } | null;

export async function iniciarSesion(_previo: ResultadoLogin, datos: FormData): Promise<ResultadoLogin> {
  const correo = String(datos.get("correo") ?? "").trim();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: String(datos.get("clave") ?? ""),
  });
  if (error) return { error: "Correo o contraseña incorrectos.", correo };

  // Una cuenta que no está en `administradores` no se queda con la sesión abierta.
  const { data: esAdmin, error: errorRol } = await supabase.rpc("es_admin");
  if (errorRol || esAdmin !== true) {
    await supabase.auth.signOut();
    return {
      error: errorRol
        ? "No pudimos comprobar tu acceso. Inténtalo otra vez."
        : "Esta cuenta no tiene acceso al panel.",
      correo,
    };
  }

  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
