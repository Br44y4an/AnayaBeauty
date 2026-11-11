/**
 * Comprueba que la base tenga lo que esta versión del código espera (migraciones v4 y v5) y avisa de los
 * ajustes de seguridad pendientes. No escribe nada: solo pregunta. Córrelo antes de publicar la web.
 *
 * Uso: node --env-file=.env.local scripts/verificar-migracion.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

let fallos = 0;
let avisos = 0;
const check = (ok, msg, detalle = "") => {
  console.log(`${ok ? "  ok     " : "  FALTA  "}${msg}${detalle ? ` (${detalle})` : ""}`);
  if (!ok) fallos++;
};
const avisar = (msg) => {
  console.log(`  AVISO  ${msg}`);
  avisos++;
};
const corto = (texto) => (texto ?? "respondió algo inesperado").slice(0, 90);

console.log("Comprobando la base de datos…\n");

// ---------- Conexión ----------
const { count, error: errConexion } = await db.from("products").select("id", { count: "exact", head: true });
check(!errConexion, "conexión con Supabase", errConexion?.message ?? `${count} productos`);
if (errConexion) process.exit(1);

// ---------- Columnas que el código consulta ----------
console.log("\nColumnas:");
for (const [tabla, columna] of [
  ["products", "precio_desde"],
  ["products", "precio_base"],
  ["products", "num_tonos"],
  ["orders", "ip_hash"],
  ["orders", "clave_idempotencia"],
  ["orders", "notas_cliente"],
  ["categories", "etiqueta_variante"],
  ["products", "etiqueta_variante"],
  ["products", "destacado"],
  ["product_shades", "agotado"],
  ["orders", "politica_version"],
  ["orders", "politica_aceptada_en"],
]) {
  const { error } = await db.from(tabla).select(columna).limit(1);
  check(!error, `${tabla}.${columna}`, error ? "no existe" : "");
}

// ---------- Funciones ----------
console.log("\nFunciones:");

const { error: errCarrito } = await db.rpc("productos_del_carrito", { p_ids: [] });
check(!errCarrito, "productos_del_carrito()", errCarrito && corto(errCarrito.message));

// Con el carrito vacío la función valida antes de tocar nada y responde CARRITO_VACIO sin crear ningún pedido.
const { error: errPedido } = await db.rpc("crear_pedido", {
  p_nombre: "verificacion",
  p_whatsapp: "0000000",
  p_ciudad: "verificacion",
  p_notas: null,
  p_items: [],
  p_ip_hash: null,
  p_clave: null,
});
const firmaV4 = !!errPedido?.message.includes("CARRITO_VACIO");
check(firmaV4, "crear_pedido() con la firma sin código", firmaV4 ? "" : corto(errPedido?.message));

const { data: normalizado, error: errNormalizar } = await db.rpc("normalizar", { t: "Pestañas Rímel" });
const okNormalizar = normalizado === "pestanas rimel";
const detalleNormalizar = errNormalizar?.message ?? `devolvió «${normalizado}»`;
check(okNormalizar, "normalizar()", okNormalizar ? "" : corto(detalleNormalizar));

const { error: errBuscar } = await db.rpc("buscar_productos", { p_grupos: ["usk621"] }).select("id").limit(1);
check(!errBuscar, "buscar_productos()", errBuscar && corto(errBuscar.message));

// Sin sesión nadie es administrador: la función existe si responde false.
const { data: esAdmin, error: errEsAdmin } = await db.rpc("es_admin");
check(esAdmin === false, "es_admin()", esAdmin === false ? "" : corto(errEsAdmin?.message ?? `devolvió ${esAdmin}`));

// Con un pedido que no existe se detiene en PEDIDO_NO_ENCONTRADO antes de cambiar nada.
const { error: errEstado } = await db.rpc("cambiar_estado_pedido", {
  p_order_id: "00000000-0000-0000-0000-000000000000",
  p_estado: "pagado",
});
const transiciones = !!errEstado?.message.includes("PEDIDO_NO_ENCONTRADO");
check(transiciones, "cambiar_estado_pedido()", transiciones ? "" : corto(errEstado?.message));

// ---------- Panel y ajustes ----------
console.log("\nPanel y ajustes:");

const { count: administradores, error: errAdmins } = await db
  .from("administradores")
  .select("user_id", { count: "exact", head: true });
check(!errAdmins, "tabla administradores", errAdmins ? "no existe" : "");
if (!errAdmins) {
  check(
    administradores > 0,
    "al menos una cuenta con acceso al panel",
    administradores > 0 ? `${administradores}` : "créala con scripts/crear-admin.mjs"
  );
}

const { data: envio } = await db.from("store_settings").select("valor").eq("clave", "envio_info").maybeSingle();
check(!!envio?.valor, "ajuste envio_info", envio?.valor ? "" : "no existe");

// Realtime responde con un mensaje de sistema: «ok» si orders está en la publicación, «error» si no.
function revisarRealtime() {
  return new Promise((resolver) => {
    let listo = false;
    let canal = null;
    const terminar = (resultado) => {
      if (listo) return;
      listo = true;
      clearTimeout(reloj);
      if (canal) db.removeChannel(canal);
      resolver(resultado);
    };
    const reloj = setTimeout(() => terminar({ estado: "sin-respuesta", detalle: "15 s sin respuesta" }), 15000);
    canal = db
      .channel("verificar-migracion")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {})
      .on("system", {}, (mensaje) => {
        if (mensaje?.extension !== "postgres_changes") return;
        terminar({ estado: mensaje.status === "ok" ? "ok" : "error", detalle: mensaje.message });
      })
      .subscribe((estado, error) => {
        if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") {
          terminar({ estado: "sin-respuesta", detalle: error?.message ?? estado });
        }
      });
  });
}

const realtime = await revisarRealtime();
if (realtime.estado === "sin-respuesta") {
  avisar(`no se pudo comprobar Realtime de orders (${corto(realtime.detalle)}). Revísalo en Database > Publications.`);
} else {
  check(realtime.estado === "ok", "Realtime publica orders", realtime.estado === "ok" ? "" : corto(realtime.detalle));
}

// ---------- Seguridad de las cuentas ----------
console.log("\nSeguridad:");
try {
  const respuesta = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: clave } });
  const ajustes = await respuesta.json();
  if (ajustes.disable_signup === false) {
    avisar(
      "el registro de cuentas nuevas sigue abierto. Desactívalo en Supabase > Authentication > Sign In / Providers " +
        "> «Allow new users to sign up»."
    );
  } else if (ajustes.disable_signup === true) {
    check(true, "registro de cuentas nuevas cerrado");
  } else {
    avisar(`no se pudo leer si el registro está abierto (respuesta ${respuesta.status}).`);
  }
} catch (e) {
  avisar(`no se pudo leer la configuración de Auth (${corto(e.message)}).`);
}

// ---------- Coherencia de los datos calculados ----------
console.log("\nDatos calculados:");

const { count: sinPrecio } = await db
  .from("products")
  .select("id", { count: "exact", head: true })
  .eq("activo", true)
  .is("precio_desde", null);

const detallePrecio = sinPrecio ? `${sinPrecio} sin precio` : "";
check(sinPrecio === 0, "todos los productos publicados tienen precio_desde", detallePrecio);

if (fallos === 0) {
  console.log("\nLa base está lista para esta versión del código.");
  if (avisos) console.log(`Revisa ${avisos === 1 ? "el aviso" : `los ${avisos} avisos`} de arriba.`);
} else {
  console.log(
    `\nFaltan ${fallos} cosa(s). En el editor SQL de Supabase ejecuta supabase/migracion-v5.sql (y antes ` +
      "supabase/migracion-v4.sql si tampoco está) y compruébalo con supabase/tests-v5.sql."
  );
}
process.exit(fallos === 0 ? 0 : 1);
