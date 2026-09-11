/**
 * Prueba END-TO-END real: dispara el server action `confirmarPedido`
 * por HTTP (igual que el navegador) contra `next dev`, y comprueba que
 * el pedido se cree Y que el aviso por correo salga de verdad.
 *
 * Uso:
 *   1) en una terminal:  npm run dev
 *   2) en otra:          node --env-file=.env.local scripts/probar-e2e-correo.mjs
 *
 * Existe porque `probar-flujo.mjs` llama a `crear_pedido` directamente y
 * por eso nunca ejercita el server action ni el envío del correo, que es
 * justo donde han estado los fallos silenciosos.
 *
 * Desde la v4 el action vive en /carrito (la bolsa y la confirmación se
 * juntaron en una sola pantalla) y ya no hay código de acceso.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { encodeReply } from "next/dist/compiled/react-server-dom-turbopack/client.edge.js";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

// El id del server action lo publica Next en su manifiesto de build.
// `/carrito` tiene varios actions (cargar la bolsa y confirmarla), así
// que hay que probarlos: el manifiesto no dice cuál es cuál.
const RUTA_MANIFIESTO = ".next/dev/server/app/carrito/page/server-reference-manifest.json";

let manifiesto;
try {
  manifiesto = JSON.parse(readFileSync(RUTA_MANIFIESTO, "utf8"));
} catch {
  console.error(
    `No se encontró ${RUTA_MANIFIESTO}.\n` +
      "Arranca `npm run dev` y abre http://localhost:3000/carrito una vez para que Next lo genere."
  );
  process.exit(1);
}

const idsDeAction = Object.keys(manifiesto.node ?? {});
check(idsDeAction.length > 0, "se encontraron los ids de los server actions", String(idsDeAction.length));

// --- Preparar producto ---
const { data: prod } = await db
  .from("products")
  .upsert(
    { referencia: "TEST-E2E", nombre: "Producto prueba E2E", stock: 20, activo: true },
    { onConflict: "referencia" }
  )
  .select("id, stock")
  .single();

await db.from("price_tiers").delete().eq("product_id", prod.id);
await db.from("price_tiers").insert([
  { product_id: prod.id, min_cantidad: 1, precio_unitario: 10000 },
  { product_id: prod.id, min_cantidad: 3, precio_unitario: 9000 },
]);

const clave = `e2e-${Date.now()}`;

/** Envía el formulario tal como lo hace el navegador. */
async function disparar(actionId) {
  const form = new FormData();
  form.set("nombre", "Prueba E2E Correo");
  form.set("whatsapp", "3009998877");
  form.set("ciudad", "Medellín");
  form.set("notas", "Pedido de prueba automática");
  form.set("clave", clave);
  form.set("items", JSON.stringify([{ producto_id: prod.id, cantidad: 3, tono: null }]));

  // `confirmarPedido` se usa con useActionState, así que recibe
  // (estadoPrevio, formData). Se codifica con el mismo encoder de React
  // que usa el navegador; enviar un FormData suelto devuelve
  // "Connection closed".
  const cuerpo = await encodeReply([null, form]);

  return fetch(`${SITIO}/carrito`, {
    method: "POST",
    headers: { "Next-Action": actionId },
    body: cuerpo,
  });
}

let numero = null;
let pedidoId = null;
let ultimaRespuesta = "";

for (const actionId of idsDeAction) {
  let r;
  try {
    r = await disparar(actionId);
  } catch (e) {
    console.error(`No se pudo conectar a ${SITIO}. ¿Está corriendo \`npm run dev\`?`);
    console.error(String(e.message ?? e));
    process.exit(1);
  }

  if (!r.ok) continue;

  ultimaRespuesta = await r.text();
  const posibleNumero = ultimaRespuesta.match(/AB-\d{4}/)?.[0];
  if (posibleNumero) {
    numero = posibleNumero;
    pedidoId = ultimaRespuesta.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    )?.[0];
    break;
  }
}

check(!!numero, "el pedido se creó a través del server action", numero ?? "");
check(!!pedidoId, "devolvió el id del pedido", pedidoId ?? "");

if (!numero) {
  console.log("\n--- última respuesta cruda (primeros 1500 chars) ---");
  console.log(ultimaRespuesta.slice(0, 1500));
}

// --- Verificar en la base ---
if (numero) {
  const { data: pedido } = await db
    .from("orders")
    .select("id, numero_pedido, total, cliente_nombre, notas_cliente, clave_idempotencia")
    .eq("numero_pedido", numero)
    .single();

  check(!!pedido, "el pedido quedó guardado en la base");
  check(pedido?.total === 27000, "cobró el escalón correcto", `total=${pedido?.total}`);
  check(
    pedido?.notas_cliente === "Pedido de prueba automática",
    "la nota de la clienta llegó hasta el pedido"
  );
  check(
    pedido?.clave_idempotencia === clave,
    "la clave del envío quedó guardada (protege contra el doble toque)"
  );

  // Limpieza
  await db.rpc("cancelar_pedido", { p_order_id: pedido.id });
  await db.from("order_items").delete().eq("order_id", pedido.id);
  await db.from("orders").delete().eq("id", pedido.id);
}

await db.from("price_tiers").delete().eq("product_id", prod.id);
await db.from("products").delete().eq("id", prod.id);

console.log(
  fallos === 0
    ? "\n✅ FLUJO E2E (server action) CORRECTO — revisa también la bandeja de CORREO_DESTINO"
    : `\n❌ ${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
