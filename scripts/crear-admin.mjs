/**
 * Crea (o actualiza) un usuario del panel de administración.
 *
 * Uso:
 *   node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "MiClaveSegura"
 *
 * El usuario queda confirmado de inmediato: no hay que verificar correo.
 */
import { createClient } from "@supabase/supabase-js";

const [correo, clave] = process.argv.slice(2);

if (!correo || !clave) {
  console.error("Uso: node --env-file=.env.local scripts/crear-admin.mjs <correo> <clave>");
  process.exit(1);
}

if (clave.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: existentes } = await db.auth.admin.listUsers();
const yaExiste = existentes?.users?.find((u) => u.email === correo);

if (yaExiste) {
  const { error } = await db.auth.admin.updateUserById(yaExiste.id, { password: clave });
  if (error) {
    console.error("✗ No se pudo actualizar:", error.message);
    process.exit(1);
  }
  console.log(`✓ Contraseña actualizada para ${correo}`);
} else {
  const { error } = await db.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
  });
  if (error) {
    console.error("✗ No se pudo crear:", error.message);
    process.exit(1);
  }
  console.log(`✓ Usuario creado: ${correo}`);
}

console.log("\nEntra al panel en /admin/login con ese correo y contraseña.");
