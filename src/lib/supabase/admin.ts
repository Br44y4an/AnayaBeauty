import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con clave de servicio: se salta Row Level Security.
 * Solo puede usarse en código de servidor. El import de "server-only"
 * hace que la compilación falle si alguien lo importa desde el navegador.
 */
export function clienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
