"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { generarSlug } from "@/lib/slug";

export type ResultadoGuardado = { ok: true; id: string } | { ok: false; error: string };

export async function subirImagen(datos: FormData): Promise<string> {
  const archivo = datos.get("archivo") as File | null;
  if (!archivo || archivo.size === 0) throw new Error("No se recibió ninguna imagen");

  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error("La imagen pesa más de 5 MB. Usa una más liviana.");
  }

  const supabase = await crearClienteServidor();
  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ruta = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("productos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
  return data.publicUrl;
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

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return { ok: true, id: productoId };
}

export async function alternarActivo(id: string, activo: boolean) {
  const supabase = await crearClienteServidor();

  // Nunca se borra un producto: los pedidos históricos lo referencian.
  const { error } = await supabase.from("products").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/productos");
  revalidatePath("/");
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
