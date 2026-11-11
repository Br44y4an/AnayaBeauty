import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/** Cliente anónimo y sin cookies: las lecturas públicas son iguales para todas y se pueden guardar en caché. */
export function clientePublico(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) {
    const faltan = [!url && "NEXT_PUBLIC_SUPABASE_URL", !clave && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean);
    throw new Error(`Falta configurar ${faltan.join(" y ")} (en .env.local o en las variables de Vercel).`);
  }

  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
