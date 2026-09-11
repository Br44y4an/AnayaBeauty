/**
 * Prueba el flujo completo de pedido contra la base de datos real.
 * Uso: node --env-file=.env.local scripts/probar-flujo.mjs
 *
 * Requiere que `supabase/migracion-v4.sql` ya esté aplicada.
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

const creados = { pedidos: [], productoId: null };

async function limpiar() {
  if (creados.pedidos.length) {
    await db.from("order_items").delete().in("order_id", creados.pedidos);
    await db.from("orders").delete().in("id", creados.pedidos);
  }
  if (creados.productoId) {
    await db.from("price_tiers").delete().eq("product_id", creados.productoId);
    await db.from("products").delete().eq("id", creados.productoId);
  }
}

// Producto de prueba propio. Antes esta prueba usaba REF-101 del sembrado de
// ejemplo, pero dependía de que ese producto siguiera activo: al quedar
// oculto desde el panel, el flujo entero fallaba con PRODUCTO_NO_DISPONIBLE
// sin que hubiera nada roto.
const { data: prod, error: errProd } = await db
  .from("products")
  .upsert(
    {
      referencia: "TEST-FLUJO",
      nombre: "Producto de prueba del flujo",
      stock: 20,
      activo: true,
    },
    { onConflict: "referencia" }
  )
  .select("id, nombre, stock")
  .single();

if (errProd) {
  console.error("No se pudo crear el producto de prueba:", errProd.message);
  process.exit(1);
}
creados.productoId = prod.id;

await db.from("price_tiers").delete().eq("product_id", prod.id);
await db.from("price_tiers").insert([
  { product_id: prod.id, min_cantidad: 1, precio_unitario: 10000 },
  { product_id: prod.id, min_cantidad: 3, precio_unitario: 9000 },
  { product_id: prod.id, min_cantidad: 6, precio_unitario: 8000 },
]);

const stockInicial = prod.stock;

/** Pedido con la firma v4: sin código. */
const pedir = (datos) =>
  db.rpc("crear_pedido", {
    p_nombre: "Prueba Flujo",
    p_whatsapp: "3009998877",
    p_ciudad: "Medellín",
    p_notas: null,
    p_ip_hash: null,
    p_clave: null,
    ...datos,
  });

// --- 1. Pedido de 3 unidades → debe costar 27.000, SIN ningún código ---
const { data: res, error: err1 } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 3 }],
});

check(!err1, "el pedido se crea sin necesidad de código", err1?.message);
if (err1) {
  await limpiar();
  console.log("\n❌ La migración v4 no parece aplicada. Corre supabase/migracion-v4.sql.");
  process.exit(1);
}
creados.pedidos.push(res.order_id);

check(res?.total === 27000, "3 unidades cuestan $27.000 (escalón de $9.000)", `total=${res?.total}`);
check(/^AB-\d{4}$/.test(res?.numero_pedido ?? ""), "el número tiene formato AB-0000", res?.numero_pedido);

// --- 2. El stock bajó ---
const { data: tras } = await db.from("products").select("stock").eq("id", prod.id).single();
check(tras.stock === stockInicial - 3, "el stock bajó 3 unidades", `${stockInicial} → ${tras.stock}`);

// --- 3. Reintento seguro: la misma clave NO crea un segundo pedido ---
// Es lo que protege contra el doble toque en "Confirmar" y contra el
// reintento del navegador cuando la señal se cae a mitad del envío.
const clave = `flujo-${Date.now()}`;
const { data: primero } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 1 }],
  p_clave: clave,
});
creados.pedidos.push(primero.order_id);

const { data: repetido } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 1 }],
  p_clave: clave,
});

check(
  repetido?.order_id === primero.order_id,
  "reenviar el mismo pedido devuelve el que ya existía",
  `${primero.numero_pedido} vs ${repetido?.numero_pedido}`
);
check(repetido?.repetido === true, "el servidor avisa de que era un reenvío");

const { data: trasRepetido } = await db
  .from("products")
  .select("stock")
  .eq("id", prod.id)
  .single();
check(
  trasRepetido.stock === stockInicial - 4,
  "el reenvío NO descuenta el stock por segunda vez",
  `${trasRepetido.stock}, esperado ${stockInicial - 4}`
);

// --- 4. El precio NO se puede manipular desde el navegador ---
const { data: res2 } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 1, precio_unitario: 1, subtotal: 1 }],
});
creados.pedidos.push(res2.order_id);
check(res2?.total === 10000, "un precio falso enviado por el navegador se ignora", `cobró ${res2?.total}, no 1`);

// --- 5. Sin stock suficiente el pedido se rechaza entero ---
const { error: errStock } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 9999 }],
});
check(!!errStock?.message.includes("SIN_STOCK"), "pedir más de lo que hay se rechaza", errStock?.message?.slice(0, 40));

// --- 6. Datos incompletos se rechazan ---
const { error: errDatos } = await pedir({
  p_nombre: "   ",
  p_items: [{ producto_id: prod.id, cantidad: 1 }],
});
check(!!errDatos?.message.includes("DATOS_INCOMPLETOS"), "un nombre vacío se rechaza");

// --- 7. La nota de la clienta llega hasta el pedido ---
const { data: conNota } = await pedir({
  p_items: [{ producto_id: prod.id, cantidad: 1 }],
  p_notas: "Es un regalo, timbre 302",
});
creados.pedidos.push(conNota.order_id);
const { data: filaNota } = await db
  .from("orders")
  .select("notas_cliente")
  .eq("id", conNota.order_id)
  .single();
check(filaNota?.notas_cliente === "Es un regalo, timbre 302", "la nota de la clienta se guarda");

// --- 8. La pantalla de éxito encuentra el pedido ---
const { data: pedido } = await db
  .from("orders")
  .select("id, numero_pedido, total, order_items(nombre_snapshot, cantidad, subtotal)")
  .eq("id", res.order_id)
  .single();
check(pedido?.order_items?.length === 1, "el pedido guardó sus líneas con snapshot");
check(pedido?.order_items?.[0]?.subtotal === 27000, "la línea guardó el subtotal correcto");

// --- 9. Cancelar devuelve el stock ---
for (const id of creados.pedidos) {
  await db.rpc("cancelar_pedido", { p_order_id: id });
}
const { data: final } = await db.from("products").select("stock").eq("id", prod.id).single();
check(final.stock === stockInicial, "cancelar devolvió todo el stock", `${final.stock} = ${stockInicial}`);

console.log(
  `\nURL de la pantalla de éxito para probar a mano:\n  http://localhost:3000/pedido/${res.order_id}`
);

await limpiar();

console.log(fallos === 0 ? "\n✅ FLUJO COMPLETO CORRECTO" : `\n❌ ${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
