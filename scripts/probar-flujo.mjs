/**
 * Prueba el flujo completo de pedido contra la base de datos real.
 * Uso: node --env-file=.env.local scripts/probar-flujo.mjs
 *
 * Limpia todo lo que crea al terminar.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let fallos = 0;
const check = (ok, msg, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

// Producto de prueba conocido
const { data: prod } = await db
  .from("products")
  .select("id, nombre, stock")
  .eq("referencia", "REF-101")
  .single();

const stockInicial = prod.stock;
const codigo = String(Math.floor(1000 + Math.random() * 8999));

await db.from("access_codes").insert({
  code: codigo,
  vence_en: new Date(Date.now() + 3600e3).toISOString(),
});

// --- 1. Pedido válido de 3 unidades → debe costar 27.000 ---
const { data: res, error: err1 } = await db.rpc("crear_pedido", {
  p_codigo: codigo,
  p_nombre: "Prueba Flujo",
  p_whatsapp: "3009998877",
  p_ciudad: "Medellín",
  p_items: [{ producto_id: prod.id, cantidad: 3 }],
  p_ip_hash: "flujo-" + Date.now(),
});

check(!err1, "el pedido se crea con un código válido", err1?.message);
check(res?.total === 27000, "3 unidades cuestan $27.000 (escalón de $9.000)", `total=${res?.total}`);
check(/^AB-\d{4}$/.test(res?.numero_pedido ?? ""), "el número tiene formato AB-0000", res?.numero_pedido);

// --- 2. El stock bajó ---
const { data: tras } = await db.from("products").select("stock").eq("id", prod.id).single();
check(tras.stock === stockInicial - 3, "el stock bajó 3 unidades", `${stockInicial} → ${tras.stock}`);

// --- 3. El código quedó quemado ---
const { data: cod } = await db.from("access_codes").select("estado").eq("code", codigo).single();
check(cod.estado === "usado", "el código quedó quemado");

// --- 4. Reusar el código falla ---
const { error: err2 } = await db.rpc("crear_pedido", {
  p_codigo: codigo,
  p_nombre: "Colada",
  p_whatsapp: "3001112222",
  p_ciudad: "Cali",
  p_items: [{ producto_id: prod.id, cantidad: 1 }],
  p_ip_hash: "flujo-reuso-" + Date.now(),
});
check(!!err2?.message.includes("CODIGO_INVALIDO"), "reusar el código es rechazado", err2?.message?.slice(0, 40));

// --- 5. El precio NO se puede manipular desde el cliente ---
// (la función ignora cualquier precio enviado; solo acepta id y cantidad)
const codigo2 = String(Math.floor(1000 + Math.random() * 8999));
await db.from("access_codes").insert({
  code: codigo2,
  vence_en: new Date(Date.now() + 3600e3).toISOString(),
});
const { data: res2 } = await db.rpc("crear_pedido", {
  p_codigo: codigo2,
  p_nombre: "Manipuladora",
  p_whatsapp: "3005554444",
  p_ciudad: "Bogotá",
  p_items: [{ producto_id: prod.id, cantidad: 1, precio_unitario: 1, subtotal: 1 }],
  p_ip_hash: "flujo-precio-" + Date.now(),
});
check(res2?.total === 10000, "un precio falso enviado por el navegador se ignora", `cobró ${res2?.total}, no 1`);

// --- 6. La pantalla de éxito encuentra el pedido ---
const { data: pedido } = await db
  .from("orders")
  .select("id, numero_pedido, total, order_items(nombre_snapshot, cantidad, subtotal)")
  .eq("id", res.order_id)
  .single();
check(pedido?.order_items?.length === 1, "el pedido guardó sus líneas con snapshot");
check(pedido?.order_items?.[0]?.subtotal === 27000, "la línea guardó el subtotal correcto");

// --- Limpieza ---
await db.rpc("cancelar_pedido", { p_order_id: res.order_id });
await db.rpc("cancelar_pedido", { p_order_id: res2.order_id });
const { data: final } = await db.from("products").select("stock").eq("id", prod.id).single();
check(final.stock === stockInicial, "cancelar devolvió todo el stock", `${final.stock} = ${stockInicial}`);

await db.from("order_items").delete().in("order_id", [res.order_id, res2.order_id]);
await db.from("access_codes").delete().in("code", [codigo, codigo2]);
await db.from("orders").delete().in("id", [res.order_id, res2.order_id]);

console.log(
  `\nURL de la pantalla de éxito para probar a mano:\n  http://localhost:3000/pedido/${res.order_id}`
);
console.log(fallos === 0 ? "\n✅ FLUJO COMPLETO CORRECTO" : `\n❌ ${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
