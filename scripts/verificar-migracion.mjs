/**
 * Comprueba que la base de datos tenga aplicado todo lo que el código
 * espera encontrar.
 *
 * Uso: node --env-file=.env.local scripts/verificar-migracion.mjs
 *
 * POR QUÉ EXISTE
 *
 * La v4 (pedido sin código) cambia la FIRMA de `crear_pedido` y añade
 * columnas que el catálogo consulta directamente. Si se despliega la web
 * antes de correr el SQL, el catálogo responde 500 y nadie puede pedir:
 * no es una degradación suave, es la tienda cerrada. Este script se
 * ejecuta antes de desplegar y dice exactamente qué falta.
 *
 * No escribe nada: solo pregunta.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, clave, { auth: { persistSession: false } });

let fallos = 0;
const check = (ok, msg, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

console.log("Comprobando la base de datos…\n");

// ---------- Conexión ----------
const { count, error: errConexion } = await db
  .from("products")
  .select("id", { count: "exact", head: true });

check(!errConexion, "conexión con Supabase", errConexion?.message ?? `${count} productos`);
if (errConexion) process.exit(1);

// ---------- Columnas que el catálogo consulta ----------
console.log("\nColumnas nuevas (migración v4):");
for (const [tabla, columna] of [
  ["products", "precio_desde"],
  ["products", "precio_base"],
  ["products", "num_tonos"],
  ["orders", "ip_hash"],
  ["orders", "clave_idempotencia"],
  ["orders", "notas_cliente"],
]) {
  const { error } = await db.from(tabla).select(columna).limit(1);
  check(!error, `${tabla}.${columna}`, error ? "no existe" : "");
}

// ---------- Funciones ----------
console.log("\nFunciones:");

const { error: errCarrito } = await db.rpc("productos_del_carrito", { p_ids: [] });
check(!errCarrito, "productos_del_carrito()", errCarrito?.message?.slice(0, 70));

// Se llama con el carrito vacío a propósito: la función valida antes de
// tocar nada, así que devuelve CARRITO_VACIO sin crear ningún pedido.
// Que conteste ESO ya demuestra que la firma nueva existe.
const { error: errPedido } = await db.rpc("crear_pedido", {
  p_nombre: "verificacion",
  p_whatsapp: "0000000",
  p_ciudad: "verificacion",
  p_notas: null,
  p_items: [],
  p_ip_hash: null,
  p_clave: null,
});
check(
  !!errPedido?.message.includes("CARRITO_VACIO"),
  "crear_pedido() con la firma sin código",
  errPedido?.message.includes("CARRITO_VACIO")
    ? ""
    : (errPedido?.message ?? "respondió algo inesperado").slice(0, 70)
);

// ---------- Coherencia de los datos calculados ----------
console.log("\nDatos calculados:");

const { count: sinPrecio } = await db
  .from("products")
  .select("id", { count: "exact", head: true })
  .eq("activo", true)
  .is("precio_desde", null);

check(
  sinPrecio === 0,
  "todos los productos publicados tienen precio_desde",
  sinPrecio ? `${sinPrecio} sin precio: no se pueden comprar` : ""
);

console.log(
  fallos === 0
    ? "\n✅ La base está lista para esta versión del código."
    : `\n❌ Faltan ${fallos} cosa(s). Ejecuta supabase/migracion-v4.sql en el editor SQL de Supabase.`
);
process.exit(fallos === 0 ? 0 : 1);
