"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoLogin = { error: string } | null;

export async function iniciarSesion(
  _previo: ResultadoLogin,
  datos: FormData
): Promise<ResultadoLogin> {
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(datos.get("correo") ?? "").trim(),
    password: String(datos.get("clave") ?? ""),
  });

  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
