/**
 * Crea una cuenta del panel (o le cambia la contraseña si ya existe) y la registra en
 * public.administradores: sin esa fila no ve pedidos ni puede guardar (la web v5 ni la deja entrar).
 *
 * Uso: node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "UnaClaveSegura"
 */
import { createClient } from "@supabase/supabase-js";

const [correoEscrito, clave] = process.argv.slice(2);
const correo = correoEscrito?.trim().toLowerCase();
const POR_PAGINA = 200;

if (!correo || !clave) {
  console.error("Uso: node --env-file=.env.local scripts/crear-admin.mjs <correo> <clave>");
  process.exit(1);
}

if (clave.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function salir(mensaje, error) {
  console.error(`${mensaje}: ${error.message}`);
  process.exit(1);
}

async function buscarPorCorreo() {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA });
    if (error) salir("No se pudo leer la lista de cuentas", error);
    const usuario = data.users.find((u) => u.email?.toLowerCase() === correo);
    if (usuario || data.users.length < POR_PAGINA) return usuario ?? null;
  }
}

let usuario = await buscarPorCorreo();

if (usuario) {
  const { error } = await db.auth.admin.updateUserById(usuario.id, { password: clave, email_confirm: true });
  if (error) salir("No se pudo cambiar la contraseña", error);
  console.log(`Contraseña actualizada para ${correo}.`);
} else {
  const { data, error } = await db.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  if (error) salir("No se pudo crear la cuenta", error);
  usuario = data.user;
  console.log(`Cuenta creada: ${correo}.`);
}

const { error: errorAdmin } = await db
  .from("administradores")
  .upsert({ user_id: usuario.id }, { onConflict: "user_id", ignoreDuplicates: true });
if (errorAdmin) {
  const ayuda = "¿falta aplicar supabase/migracion-v5.sql?";
  salir(`La cuenta quedó lista, pero no se pudo registrar en administradores (${ayuda})`, errorAdmin);
}

console.log("Registrada en administradores: ya puede ver pedidos y guardar cambios.");
console.log("\nEntra al panel en /admin/login con ese correo y contraseña.");
