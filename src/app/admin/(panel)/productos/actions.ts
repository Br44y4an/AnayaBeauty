"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { generarSlug } from "@/lib/slug";
import { rutaEnBucket } from "@/lib/storage";
import { clienteAdmin } from "@/lib/supabase/admin";
import { validarImagen, rutaDeImagen } from "@/lib/imagen";

export type ResultadoGuardado = { ok: true; id: string } | { ok: false; error: string };

export type ResultadoSubida = { ok: true; url: string } | { ok: false; error: string };

/**
 * Sube la foto de un producto al bucket `productos`.
 *
 * Devuelve el error en vez de lanzarlo: una excepción dentro de un Server
 * Action llega al navegador como "Minified React error #441" (React borra el
 * mensaje en producción), así que el panel no podía decir qué había fallado.
 *
 * Sube con el cliente de servicio, igual que el resto de escrituras del panel:
 * el bucket no tiene política de RLS de escritura para `authenticated`, así
 * que subir con la sesión del usuario devolvía "new row violates row-level
 * security policy". Por eso se exige sesión aquí de forma explícita antes.
 */
export async function subirImagen(datos: FormData): Promise<ResultadoSubida> {
  const sesion = await crearClienteServidor();
  const {
    data: { user },
  } = await sesion.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };

  const archivo = datos.get("archivo") as File | null;

  const problema = validarImagen(archivo);
  if (problema) return { ok: false, error: problema };

  const ruta = rutaDeImagen(archivo!.name, crypto.randomUUID());
  const supabase = clienteAdmin();

  const { error } = await supabase.storage
    .from("productos")
    .upload(ruta, archivo!, { contentType: archivo!.type || undefined, upsert: false });

  if (error) return { ok: false, error: `No se pudo subir la imagen: ${error.message}` };

  const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
  return { ok: true, url: data.publicUrl };
}

export async function guardarProducto(
  _previo: ResultadoGuardado | null,
  datos: FormData
): Promise<ResultadoGuardado> {
  const supabase = await crearClienteServidor();

  const id = String(datos.get("id") ?? "");
  const referencia = String(datos.get("referencia") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const stock = Number(datos.get("stock") ?? 0);
  const categoryId = String(datos.get("category_id") ?? "") || null;
  const descripcion = String(datos.get("descripcion") ?? "").trim() || null;
  const imagenPrincipal = String(datos.get("imagen_principal") ?? "") || null;
  const activo = datos.get("activo") === "on";

  if (!referencia) return { ok: false, error: "La referencia es obligatoria." };
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!Number.isInteger(stock) || stock < 0)
    return { ok: false, error: "El stock debe ser 0 o un número mayor." };

  // Los escalones llegan como listas paralelas de mínimos y precios
  const minimos = datos.getAll("min_cantidad").map(Number);
  const precios = datos.getAll("precio_unitario").map(Number);

  const escalones = minimos
    .map((min, i) => ({ min_cantidad: min, precio_unitario: precios[i] }))
    .filter(
      (e) =>
        Number.isInteger(e.min_cantidad) &&
        e.min_cantidad >= 1 &&
        Number.isFinite(e.precio_unitario) &&
        e.precio_unitario > 0
    );

  if (escalones.length === 0)
    return { ok: false, error: "Agrega al menos el precio de 1 unidad." };

  if (!escalones.some((e) => e.min_cantidad === 1))
    return {
      ok: false,
      error: "Falta el precio para 1 unidad: sin él no se puede vender una sola.",
    };

  const duplicados = new Set(escalones.map((e) => e.min_cantidad)).size !== escalones.length;
  if (duplicados)
    return { ok: false, error: "Hay dos escalones con la misma cantidad mínima." };

  const fila = {
    referencia,
    nombre,
    descripcion,
    category_id: categoryId,
    imagen_principal: imagenPrincipal,
    stock,
    activo,
  };

  let productoId = id;

  if (id) {
    const { error } = await supabase.from("products").update(fila).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert(fila)
      .select("id")
      .single();

    if (error) {
      return {
        ok: false,
        error: error.message.includes("duplicate")
          ? `Ya existe un producto con la referencia ${referencia}.`
          : error.message,
      };
    }
    productoId = data.id;
  }

  // Se reemplazan todos los escalones: más simple y seguro que compararlos
  await supabase.from("price_tiers").delete().eq("product_id", productoId);

  const { error: errorEscalones } = await supabase
    .from("price_tiers")
    .insert(escalones.map((e) => ({ ...e, product_id: productoId })));

  if (errorEscalones) return { ok: false, error: errorEscalones.message };

  // Tonos: llegan como listas paralelas de nombre y color
  const nombresTono = datos.getAll("tono_nombre").map((v) => String(v).trim());
  const coloresTono = datos.getAll("tono_color").map((v) => String(v));

  const tonos = nombresTono
    .map((nombre, i) => ({ nombre, color_hex: coloresTono[i] ?? "#E5308A", orden: i }))
    .filter((t) => t.nombre.length > 0);

  const nombresRepetidos =
    new Set(tonos.map((t) => t.nombre.toLowerCase())).size !== tonos.length;

  if (nombresRepetidos)
    return { ok: false, error: "Hay dos tonos con el mismo nombre." };

  await supabase.from("product_shades").delete().eq("product_id", productoId);

  if (tonos.length > 0) {
    const { error: errorTonos } = await supabase
      .from("product_shades")
      .insert(tonos.map((t) => ({ ...t, product_id: productoId })));

    if (errorTonos) return { ok: false, error: errorTonos.message };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return { ok: true, id: productoId };
}

export async function alternarActivo(id: string, activo: boolean) {
  const supabase = await crearClienteServidor();

  // Ocultar es la vía reversible: el producto sigue existiendo para editarlo
  // después. Para borrarlo de verdad está eliminarProducto.
  const { error } = await supabase.from("products").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/productos");
  revalidatePath("/");
}

export type ResultadoEliminado = { ok: true } | { ok: false; error: string };

/**
 * Borra el producto de verdad. Los pedidos históricos no se pierden: cada
 * línea guarda su propia copia de referencia, nombre, tono y precio, y la
 * columna product_id queda en null (on delete set null). Los escalones y los
 * tonos se van en cascada.
 */
export async function eliminarProducto(id: string): Promise<ResultadoEliminado> {
  if (!id) return { ok: false, error: "Falta el producto a eliminar." };

  const supabase = await crearClienteServidor();

  // El proxy ya protege /admin, pero borrar es definitivo: se comprueba aquí
  // también, porque sin sesión el delete no falla, simplemente no borra nada.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };

  const { data: producto, error: errorLectura } = await supabase
    .from("products")
    .select("referencia, imagen_principal")
    .eq("id", id)
    .maybeSingle();

  if (errorLectura) return { ok: false, error: errorLectura.message };
  if (!producto) return { ok: false, error: "Ese producto ya no existe." };

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // La imagen quedaría huérfana en el bucket. Solo se borran las nuestras:
  // las importadas por CSV pueden apuntar a cualquier otro sitio.
  // Con la sesión del usuario el remove no falla: devuelve 0 objetos y deja
  // el archivo ahí (el bucket no tiene política de borrado). Va con el cliente
  // de servicio, que sí puede.
  const ruta = rutaEnBucket(producto.imagen_principal, "productos");
  if (ruta) await clienteAdmin().storage.from("productos").remove([ruta]);

  revalidatePath("/admin/productos");
  revalidatePath("/");
  revalidatePath(`/producto/${producto.referencia}`);
  return { ok: true };
}

export async function guardarCategoria(datos: FormData) {
  const supabase = await crearClienteServidor();

  const id = String(datos.get("id") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim();
  const orden = Number(datos.get("orden") ?? 0);
  const padre = String(datos.get("categoria_padre_id") ?? "") || null;

  if (!nombre) return;

  const fila = {
    nombre,
    slug: generarSlug(nombre),
    orden: Number.isInteger(orden) ? orden : 0,
    categoria_padre_id: padre,
  };

  if (id) await supabase.from("categories").update(fila).eq("id", id);
  else await supabase.from("categories").insert(fila);

  revalidatePath("/admin/categorias");
  revalidatePath("/");
}

export async function eliminarCategoria(id: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("categories").update({ activo: false }).eq("id", id);

  revalidatePath("/admin/categorias");
  revalidatePath("/");
}

export async function guardarReglaDescuento(datos: FormData) {
  const supabase = await crearClienteServidor();

  const montoMinimo = Number(datos.get("monto_minimo") ?? 0);
  const porcentaje = Number(datos.get("porcentaje") ?? 0);

  if (!Number.isInteger(montoMinimo) || montoMinimo <= 0) return;
  if (!Number.isInteger(porcentaje) || porcentaje <= 0 || porcentaje > 100) return;

  await supabase
    .from("discount_rules")
    .upsert(
      { monto_minimo: montoMinimo, porcentaje, activo: true },
      { onConflict: "monto_minimo" }
    );

  revalidatePath("/admin/descuentos");
  revalidatePath("/carrito");
}

export async function alternarReglaDescuento(id: string, activo: boolean) {
  const supabase = await crearClienteServidor();
  await supabase.from("discount_rules").update({ activo }).eq("id", id);

  revalidatePath("/admin/descuentos");
  revalidatePath("/carrito");
}

export async function eliminarReglaDescuento(id: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("discount_rules").delete().eq("id", id);

  revalidatePath("/admin/descuentos");
  revalidatePath("/carrito");
}

export async function guardarUmbralPorMayor(datos: FormData) {
  const supabase = await crearClienteServidor();

  const umbral = Number(datos.get("umbral_por_mayor") ?? 0);
  if (!Number.isInteger(umbral) || umbral <= 0) return;

  await supabase.from("store_settings").upsert(
    {
      clave: "umbral_por_mayor",
      valor: String(umbral),
      publico: true,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "clave" }
  );

  revalidatePath("/admin/descuentos");
  revalidatePath("/carrito");
}
