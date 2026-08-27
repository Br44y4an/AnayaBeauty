/**
 * Verifica que crear_pedido en PostgreSQL cobre exactamente lo mismo que
 * el motor de descuentos de TypeScript le muestra a la clienta.
 *
 * Los valores esperados son los mismos que verifican las pruebas de
 * src/lib/__tests__/discounts.test.ts. Si ambas implementaciones se
 * separan, este script lo detecta.
 *
 * Uso: node --env-file=.env.local scripts/probar-descuentos.mjs
 * Limpia todo lo que crea.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let fallos = 0;
const ok = (c, m, d = "") => {
  console.log(`${c ? "✓" : "✗"} ${m}${d ? ` — ${d}` : ""}`);
  if (!c) fallos++;
};

const pesos = (v) => `$${new Intl.NumberFormat("es-CO").format(v)}`;
const creados = { productos: [], codigos: [], pedidos: [] };

async function crearProducto(referencia, nombre, escalones, stock, tonos = []) {
  const { data: p } = await db
    .from("products")
    .upsert({ referencia, nombre, stock, activo: true }, { onConflict: "referencia" })
    .select("id")
    .single();

  await db.from("price_tiers").delete().eq("product_id", p.id);
  await db.from("price_tiers").insert(
    escalones.map(([min, precio]) => ({
      product_id: p.id,
      min_cantidad: min,
      precio_unitario: precio,
    }))
  );

  await db.from("product_shades").delete().eq("product_id", p.id);
  if (tonos.length) {
    await db.from("product_shades").insert(
      tonos.map((t, i) => ({ product_id: p.id, nombre: t.nombre, color_hex: t.color, orden: i }))
    );
  }

  creados.productos.push(p.id);
  return p.id;
}

async function pedir(items) {
  const code = String(Math.floor(1000 + Math.random() * 8999));
  await db.from("access_codes").insert({
    code,
    vence_en: new Date(Date.now() + 3600e3).toISOString(),
  });
  creados.codigos.push(code);

  const { data, error } = await db.rpc("crear_pedido", {
    p_codigo: code,
    p_nombre: "Prueba Descuentos",
    p_whatsapp: "3009998877",
    p_ciudad: "Medellín",
    p_items: items,
    p_ip_hash: "desc-" + Math.random(),
  });

  if (error) throw new Error(error.message);
  creados.pedidos.push(data.order_id);
  return data;
}

// ---------- Productos de prueba ----------
// A: 1→10.000, 3→9.000, 6→8.000   (más bajo 8.000)
// B: 1→20.000, 3→18.000           (más bajo 18.000)
const A = await crearProducto("TEST-A", "Producto A de prueba", [[1, 10000], [3, 9000], [6, 8000]], 500, [
  { nombre: "Cereza", color: "#C81E4A" },
  { nombre: "Vino", color: "#6E1E38" },
]);
const B = await crearProducto("TEST-B", "Producto B de prueba", [[1, 20000], [3, 18000]], 500);

console.log("=== 1. Pedido pequeño: sin beneficios ===");
{
  const r = await pedir([{ producto_id: A, cantidad: 1, tono: "Cereza" }]);
  ok(r.subtotal === 10000, "subtotal", pesos(r.subtotal));
  ok(r.por_mayor === false, "no aplica por mayor");
  ok(r.porcentaje === 0, "sin porcentaje");
  ok(r.total === 10000, "total", pesos(r.total));
}

console.log("\n=== 2. Supera $50.000: descuento del 5% ===");
{
  // 7 unidades de A al escalón de 8.000 = 56.000
  const r = await pedir([{ producto_id: A, cantidad: 7, tono: "Cereza" }]);
  ok(r.subtotal === 56000, "subtotal antes del %", pesos(r.subtotal));
  ok(r.por_mayor === false, "todavía no hay por mayor");
  ok(r.porcentaje === 5, "porcentaje aplicado", `${r.porcentaje}%`);
  ok(r.descuento === 2800, "descuento", pesos(r.descuento));
  ok(r.total === 53200, "total", pesos(r.total));
}

console.log("\n=== 3. Justo en $200.000: se activa el precio por mayor ===");
{
  // A x2 (10.000 c/u = 20.000) + B x10 (18.000 c/u = 180.000) = 200.000 exactos
  const r = await pedir([
    { producto_id: A, cantidad: 2, tono: "Vino" },
    { producto_id: B, cantidad: 10 },
  ]);

  ok(r.por_mayor === true, "se activó el por mayor con $200.000 exactos");
  // A baja a 8.000 → 16.000 ; B ya estaba en su más bajo → 180.000
  ok(r.subtotal === 196000, "subtotal con precio por mayor", pesos(r.subtotal));
  ok(r.porcentaje === 5, "y encima el 5%", `${r.porcentaje}%`);
  ok(r.descuento === 9800, "descuento sobre 196.000", pesos(r.descuento));
  ok(r.total === 186200, "total final", pesos(r.total));
  console.log(`   cascada: 200.000 → por mayor 196.000 → −5% → ${pesos(r.total)}`);
}

console.log("\n=== 4. El por mayor NO se revierte al bajar del umbral ===");
{
  const r = await pedir([
    { producto_id: A, cantidad: 2 },
    { producto_id: B, cantidad: 10 },
  ]);
  ok(r.subtotal < 200000, "el subtotal quedó bajo el umbral", pesos(r.subtotal));
  ok(r.por_mayor === true, "aun así el por mayor sigue aplicado (sin bucle)");
}

console.log("\n=== 5. El tono llega hasta la línea del pedido ===");
{
  const r = await pedir([
    { producto_id: A, cantidad: 1, tono: "Cereza" },
    { producto_id: A, cantidad: 2, tono: "Vino" },
  ]);

  const { data: lineas } = await db
    .from("order_items")
    .select("nombre_snapshot, tono_snapshot, cantidad")
    .eq("order_id", r.order_id)
    .order("cantidad");

  ok(lineas.length === 2, "dos tonos = dos líneas separadas");
  ok(lineas[0].tono_snapshot === "Cereza", "primer tono guardado", lineas[0].tono_snapshot);
  ok(lineas[1].tono_snapshot === "Vino", "segundo tono guardado", lineas[1].tono_snapshot);
  // 1 + 2 = 3 unidades del mismo producto → las tres al escalón de 3.
  ok(r.subtotal === 27000, "y las 3 unidades se cobran agrupadas", pesos(r.subtotal));
}

console.log("\n=== 6. Los tonos comparten el stock del producto ===");
{
  const C = await crearProducto("TEST-C", "Producto C de prueba", [[1, 10000]], 4);
  let rechazado = false;
  try {
    // 3 + 3 = 6 unidades pedidas, pero solo hay 4 en total
    await pedir([
      { producto_id: C, cantidad: 3, tono: "Uno" },
      { producto_id: C, cantidad: 3, tono: "Dos" },
    ]);
  } catch (e) {
    rechazado = e.message.includes("SIN_STOCK");
  }
  ok(rechazado, "pedir más de lo que hay entre todos los tonos se rechaza");

  const { data: c } = await db.from("products").select("stock").eq("id", C).single();
  ok(c.stock === 4, "el stock no se movió tras el rechazo", String(c.stock));
}

console.log("\n=== 7. Los tonos de un producto suman para elegir el escalón ===");
{
  // 2 de Cereza + 1 de Vino = 3 unidades del MISMO producto. Antes cada
  // línea elegía su escalón por separado y las tres salían a 10.000
  // ($30.000); ahora las tres alcanzan el escalón de 3 → 9.000 c/u.
  const r = await pedir([
    { producto_id: A, cantidad: 2, tono: "Cereza" },
    { producto_id: A, cantidad: 1, tono: "Vino" },
  ]);

  ok(r.subtotal === 27000, "3 unidades entre 2 tonos al escalón de 3", pesos(r.subtotal));

  const { data: lineas } = await db
    .from("order_items")
    .select("tono_snapshot, cantidad, precio_unitario_aplicado, subtotal")
    .eq("order_id", r.order_id)
    .order("cantidad", { ascending: false });

  ok(
    lineas.every((l) => l.precio_unitario_aplicado === 9000),
    "los dos tonos quedaron al mismo precio unitario",
    lineas.map((l) => `${l.tono_snapshot}:${pesos(l.precio_unitario_aplicado)}`).join(" ")
  );
  ok(lineas[0].subtotal === 18000, "Cereza x2", pesos(lineas[0].subtotal));
  ok(lineas[1].subtotal === 9000, "Vino x1", pesos(lineas[1].subtotal));
}

console.log("\n=== 8. Productos distintos NO suman entre sí ===");
{
  // 2 de A + 1 de B: cada producto se queda en su propio escalón de 1.
  // Es el guardarraíl de que la agrupación no se pase de lista.
  const r = await pedir([
    { producto_id: A, cantidad: 2 },
    { producto_id: B, cantidad: 1 },
  ]);

  // A: 2 x 10.000 = 20.000 (no alcanza su escalón de 3) ; B: 1 x 20.000
  ok(r.subtotal === 40000, "cada producto con su propio escalón", pesos(r.subtotal));
  ok(r.por_mayor === false, "sin por mayor");
}

console.log("\n=== 9. El precio sigue sin poder manipularse desde el navegador ===");
{
  const r = await pedir([
    { producto_id: A, cantidad: 1, precio_unitario: 1, subtotal: 1, total: 1 },
  ]);
  ok(r.total === 10000, "ignoró el precio falso", `cobró ${pesos(r.total)}`);
}

// ---------- Limpieza ----------
for (const id of creados.pedidos) await db.rpc("cancelar_pedido", { p_order_id: id });
await db.from("order_items").delete().in("order_id", creados.pedidos);
await db.from("orders").delete().in("id", creados.pedidos);
await db.from("access_codes").delete().in("code", creados.codigos);
await db.from("price_tiers").delete().in("product_id", creados.productos);
await db.from("product_shades").delete().in("product_id", creados.productos);
await db.from("products").delete().in("id", creados.productos);

console.log(fallos === 0 ? "\n✅ POSTGRESQL Y TYPESCRIPT COBRAN LO MISMO" : `\n❌ ${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
