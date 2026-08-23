import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacenCookies.getAll(),
        setAll: (aGuardar) => {
          try {
            aGuardar.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, options)
            );
          } catch {
            // Los Server Components no pueden escribir cookies;
            // el middleware de sesión se encarga de refrescarlas.
          }
        },
      },
    }
  );
}
