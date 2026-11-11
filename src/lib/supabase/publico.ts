import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente anónimo y sin cookies para las lecturas públicas: el resultado es
 * el mismo para todas las clientas y por eso se puede guardar en caché.
 */
export function clientePublico(): SupabaseClient {
  cliente ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  return cliente;
}
