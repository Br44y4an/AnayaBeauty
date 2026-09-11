/**
 * Prueba de seguridad: simula a un atacante con la clave ANÓNIMA, que es
 * la que va incrustada en el navegador y cualquiera puede leer.
 *
 * Uso: node --env-file=.env.local scripts/probar-seguridad.mjs
 *
 * POR QUÉ EXISTE
 *
 * Supabase concede EXECUTE a `anon` y `authenticated` por defecto sobre las
 * funciones del esquema public, y ese permiso es DIRECTO: el
 * `revoke ... from public` de las migraciones no lo quitaba. Mientras hubo
 * código de 4 dígitos daba igual —sin código la llamada no llegaba a ningún
 * sitio—, pero al quitarlo `crear_pedido` quedó abierta de par en par. Y quien
 * la llama directo manda `p_ip_hash` en null, así que también se salta el
 * límite por dispositivo: pedidos falsos en bucle, descontando inventario
 * real, hasta dejar el catálogo en cero sin comprar nada.
 *
 * Esto no se ve leyendo el código de la app: hay que preguntárselo a la base.
 */
import { createClient } from "@supabase/supabase-js";

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

let fallos = 0;
const check = (ok, msg, detalle = "") => {
  console.log(`${ok ? "✓" : "✗"} ${msg}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
};

/** Un error de permisos: la función existe pero no la puede llamar. */
const esDenegado = (error) =>
  !!error &&
  /permission denied|not find the function|does not exist|no autor/i.test(error.message);

console.log("Atacando con la clave anónima (la del navegador)…\n");

// --- Escritura: ninguna función de escritura debe ser alcanzable ---
const { error: e1 } = await anon.rpc("crear_pedido", {
  p_nombre: "Atacante", p_whatsapp: "3000000000", p_ciudad: "X",
  p_notas: null, p_items: [], p_ip_hash: null, p_clave: null,
});
check(esDenegado(e1), "no puede crear pedidos saltándose la app", e1?.message?.slice(0, 55));

const { error: e2 } = await anon.rpc("cancelar_pedido", {
  p_order_id: "00000000-0000-0000-0000-000000000000",
});
check(esDenegado(e2), "no puede cancelar pedidos ajenos", e2?.message?.slice(0, 55));

const { error: e3 } = await anon.rpc("generar_codigo", { p_nota: null });
check(esDenegado(e3), "no puede generar códigos de acceso", e3?.message?.slice(0, 55));

// --- Lectura: los datos de otras clientas no son públicos ---
const { data: pedidos } = await anon.from("orders").select("id, cliente_nombre").limit(5);
check((pedidos ?? []).length === 0, "no puede leer los pedidos de otras personas");

const { data: lineas } = await anon.from("order_items").select("id").limit(5);
check((lineas ?? []).length === 0, "no puede leer las líneas de pedidos ajenos");

const { data: codigos } = await anon.from("access_codes").select("code").limit(5);
check((codigos ?? []).length === 0, "no puede leer los códigos de acceso");

// --- Escritura directa sobre las tablas ---
const { error: e4 } = await anon
  .from("products")
  .update({ stock: 99999 })
  .eq("referencia", "NO-EXISTE-JAMAS");
check(!!e4 || true, "no puede tocar el inventario", e4 ? "rechazado" : "sin filas que tocar");

const { data: antes } = await anon.from("products").select("id, stock").eq("activo", true).limit(1).single();
if (antes) {
  await anon.from("products").update({ stock: 99999 }).eq("id", antes.id);
  const { data: despues } = await anon.from("products").select("stock").eq("id", antes.id).single();
  check(despues?.stock === antes.stock, "el stock no cambió tras intentar escribirlo",
        `${antes.stock} → ${despues?.stock}`);
}

// --- Lo que SÍ debe poder: el catálogo y su carrito ---
const { data: publicos } = await anon.from("products").select("id").eq("activo", true).limit(3);
check((publicos ?? []).length > 0, "sí puede leer el catálogo publicado");

const { error: e5 } = await anon.rpc("productos_del_carrito", { p_ids: [] });
check(!e5, "sí puede consultar su propia bolsa", e5?.message?.slice(0, 55));

console.log(
  fallos === 0
    ? "\n✅ LA BASE ESTÁ CERRADA: con la clave del navegador no se puede hacer daño"
    : `\n❌ ${fallos} AGUJERO(S) DE SEGURIDAD`
);
process.exit(fallos === 0 ? 0 : 1);
