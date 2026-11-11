"use server";

import { refresh } from "next/cache";
import { exigirAdmin } from "@/lib/admin/sesion";
import { leerFormularioProducto } from "@/lib/admin/producto";
import { diffVariantes, requiereDosPasos, type VarianteEditable } from "@/lib/admin/variantes";
import type { Resultado } from "@/lib/admin/resultado";
import { mapearVariantes, type FilaVariante } from "@/lib/data/catalogo";
import { invalidarCatalogo } from "@/lib/data/invalidar";
import { esUuid } from "@/lib/ids";
import { tipoDeImagen, validarImagen } from "@/lib/imagen";
import { rutaEnBucket } from "@/lib/storage";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Escalon } from "@/lib/pricing";
import type { Variante } from "@/lib/types";

// Escriben con la sesión de la administradora: RLS (`es_admin()`) es la segunda barrera tras exigirAdmin().

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;
type Fallo = { ok: false; error: string };

const BUCKET = "productos";
const prefijoFotos = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

function falloDeBase(mensaje: string, error: { message: string }): Fallo {
  console.error(`[panel] ${mensaje}:`, error);
  return { ok: false, error: `${mensaje}. Intenta otra vez. Detalle: ${error.message}` };
}

const REFERENCIA_REPETIDA = (referencia: string) => ({
  ok: false as const,
  error: "Revisa los campos marcados.",
  campos: { referencia: `Ya existe un producto con la referencia ${referencia}.` },
});

/** Borra del bucket una foto que ya ningún producto usa. Si falla, solo queda un archivo de más. */
async function borrarFotoSiHuerfana(supabase: Supabase, url: string): Promise<void> {
  const ruta = url.startsWith(prefijoFotos()) ? rutaEnBucket(url, BUCKET) : null;
  if (!ruta) return;

  const [principal, galeria] = await Promise.all([
    supabase.from("products").select("id").eq("imagen_principal", url).limit(1),
    supabase.from("products").select("id").contains("galeria", [url]).limit(1),
  ]);
  if (principal.error || galeria.error || principal.data?.length || galeria.data?.length) return;

  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) console.error("[panel] No se pudo borrar la foto anterior:", error);
}

/** Sube la foto ya comprimida en el navegador. `descartar`: la subida anterior que no se llegó a guardar. */
export async function subirImagen(datos: FormData): Promise<Resultado<{ url: string }>> {
  await exigirAdmin();

  const archivo = datos.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, error: "No seleccionaste ninguna imagen." };
  const problema = validarImagen(archivo);
  if (problema) return { ok: false, error: problema };

  const tipo = tipoDeImagen(new Uint8Array(await archivo.slice(0, 16).arrayBuffer()));
  if (!tipo) return { ok: false, error: "Ese archivo no es una foto en JPG, PNG o WebP." };

  const supabase = await crearClienteServidor();
  const ruta = `${crypto.randomUUID()}.${tipo.extension}`;
  // El nombre es único y no se reescribe: el navegador puede guardarla un año.
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: tipo.mime, cacheControl: "31536000", upsert: false });
  if (error) return falloDeBase("No se pudo subir la foto", error);

  const descartar = String(datos.get("descartar") ?? "");
  if (descartar) await borrarFotoSiHuerfana(supabase, descartar);

  return { ok: true, url: supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl };
}

/** Sube o cambia los precios y después quita los que sobran: el producto nunca queda sin precio. */
async function guardarEscalones(supabase: Supabase, productoId: string, escalones: Escalon[]): Promise<Fallo | null> {
  const filas = escalones.map((e) => ({
    product_id: productoId,
    min_cantidad: e.minCantidad,
    precio_unitario: e.precioUnitario,
  }));
  const { error } = await supabase.from("price_tiers").upsert(filas, { onConflict: "product_id,min_cantidad" });
  if (error) return falloDeBase("No se pudieron guardar los precios", error);

  const minimos = `(${escalones.map((e) => e.minCantidad).join(",")})`;
  const { error: errorSobrantes } = await supabase
    .from("price_tiers")
    .delete()
    .eq("product_id", productoId)
    .not("min_cantidad", "in", minimos);
  return errorSobrantes ? falloDeBase("No se pudieron quitar los precios que borraste", errorSobrantes) : null;
}

/** Por id: borra, actualiza e inserta. Los ids se conservan porque las bolsas guardadas los usan. */
async function guardarVariantes(
  supabase: Supabase,
  productoId: string,
  actuales: Variante[],
  nuevas: VarianteEditable[]
): Promise<Fallo | null> {
  const diff = diffVariantes(actuales, nuevas);
  const fila = (v: Omit<Variante, "id">) => ({
    product_id: productoId,
    nombre: v.nombre,
    color_hex: v.colorHex,
    orden: v.orden,
    agotado: v.agotado,
  });

  if (diff.borrar.length > 0) {
    const { error } = await supabase.from("product_shades").delete().eq("product_id", productoId).in("id", diff.borrar);
    if (error) return falloDeBase("No se pudieron quitar las variantes", error);
  }

  if (diff.actualizar.length > 0) {
    if (requiereDosPasos(actuales, diff)) {
      const nombreActual = new Map(actuales.map((v) => [v.id, v.nombre]));
      const temporales = diff.actualizar
        .filter((v) => v.nombre !== nombreActual.get(v.id))
        .map((v) => ({ id: v.id, ...fila(v), nombre: `~${v.id}` }));
      const { error } = await supabase.from("product_shades").upsert(temporales, { onConflict: "id" });
      if (error) return falloDeBase("No se pudieron renombrar las variantes", error);
    }
    const finales = diff.actualizar.map((v) => ({ id: v.id, ...fila(v) }));
    const { error } = await supabase.from("product_shades").upsert(finales, { onConflict: "id" });
    if (error) return falloDeBase("No se pudieron actualizar las variantes", error);
  }

  if (diff.insertar.length > 0) {
    const { error } = await supabase.from("product_shades").insert(diff.insertar.map(fila));
    if (error) return falloDeBase("No se pudieron agregar las variantes", error);
  }
  return null;
}

type ProductoActual = { imagen_principal: string | null; product_shades: FilaVariante[] | null };

export async function guardarProducto(datos: FormData): Promise<Resultado<{ id: string }>> {
  await exigirAdmin();
  const supabase = await crearClienteServidor();

  const idEnviado = String(datos.get("id") ?? "").trim();
  let actual: ProductoActual | null = null;
  if (idEnviado) {
    if (!esUuid(idEnviado)) return { ok: false, error: "Este producto no es válido. Vuelve a la lista." };
    const { data, error } = await supabase
      .from("products")
      .select("imagen_principal, product_shades ( id, nombre, color_hex, orden, agotado )")
      .eq("id", idEnviado)
      .maybeSingle()
      .overrideTypes<ProductoActual, { merge: false }>();
    if (error) return falloDeBase("No se pudo leer el producto", error);
    if (!data) return { ok: false, error: "Este producto ya no existe. Vuelve a la lista." };
    actual = data;
  }

  const lectura = leerFormularioProducto(datos, {
    prefijoFotos: prefijoFotos(),
    imagenActual: actual?.imagen_principal ?? null,
  });
  if (!lectura.ok) return lectura;
  const p = lectura.producto;

  let repetida = supabase.from("products").select("id").eq("referencia", p.referencia).limit(1);
  if (p.id) repetida = repetida.neq("id", p.id);
  const { data: otros, error: errorReferencia } = await repetida;
  if (errorReferencia) return falloDeBase("No se pudo comprobar la referencia", errorReferencia);
  if (otros && otros.length > 0) return REFERENCIA_REPETIDA(p.referencia);

  const fila = {
    referencia: p.referencia,
    nombre: p.nombre,
    descripcion: p.descripcion,
    category_id: p.categoriaId,
    etiqueta_variante: p.etiquetaVariante,
    imagen_principal: p.imagenPrincipal,
    stock: p.stock,
    destacado: p.destacado,
  };

  let productoId: string;
  if (p.id) {
    const { error } = await supabase.from("products").update({ ...fila, activo: p.activo }).eq("id", p.id);
    if (error) return error.code === "23505" ? REFERENCIA_REPETIDA(p.referencia) : falloDeBase("No se pudo guardar el producto", error);
    productoId = p.id;
  } else {
    // Se crea oculto y se publica al final: si algo falla a mitad, no queda a la venta sin precios.
    const { data, error } = await supabase.from("products").insert({ ...fila, activo: false }).select("id").single();
    if (error) return error.code === "23505" ? REFERENCIA_REPETIDA(p.referencia) : falloDeBase("No se pudo crear el producto", error);
    productoId = data.id;
  }

  const actuales = mapearVariantes(actual?.product_shades ?? []);
  let fallo =
    (await guardarEscalones(supabase, productoId, p.escalones)) ??
    (await guardarVariantes(supabase, productoId, actuales, p.variantes));

  if (!fallo && !p.id && p.activo) {
    const { error } = await supabase.from("products").update({ activo: true }).eq("id", productoId);
    if (error) fallo = falloDeBase("No se pudo publicar el producto", error);
  }
  if (fallo) {
    // Uno nuevo se deshace entero para que volver a intentar no choque con su propia referencia.
    if (!p.id) await supabase.from("products").delete().eq("id", productoId);
    return fallo;
  }

  const fotoAnterior = actual?.imagen_principal ?? null;
  if (fotoAnterior && fotoAnterior !== p.imagenPrincipal) await borrarFotoSiHuerfana(supabase, fotoAnterior);

  invalidarCatalogo();
  return { ok: true, id: productoId };
}

async function cambiarProducto(id: string, cambio: { activo: boolean } | { destacado: boolean }): Promise<Resultado> {
  await exigirAdmin();
  if (!esUuid(id)) return { ok: false, error: "Este producto no es válido." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("products").update(cambio).eq("id", id).select("id");
  if (error) return falloDeBase("No se pudo cambiar el producto", error);
  if (!data?.length) return { ok: false, error: "Este producto ya no existe. Recarga la lista." };

  invalidarCatalogo();
  refresh();
  return { ok: true };
}

/** Ocultar es la vía reversible: el producto sigue en el panel para volver a mostrarlo. */
export async function cambiarVisibilidad(id: string, activo: boolean): Promise<Resultado> {
  return cambiarProducto(id, { activo: activo === true });
}

export async function cambiarDestacado(id: string, destacado: boolean): Promise<Resultado> {
  return cambiarProducto(id, { destacado: destacado === true });
}

/**
 * Borra el producto de verdad. Los pedidos no se pierden: cada línea guarda su copia de referencia,
 * nombre, tono y precio. Los escalones y las variantes se van en cascada.
 */
export async function eliminarProducto(id: string): Promise<Resultado<{ referencia: string }>> {
  await exigirAdmin();
  if (!esUuid(id)) return { ok: false, error: "Falta el producto a eliminar." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("referencia, imagen_principal")
    .maybeSingle()
    .overrideTypes<{ referencia: string; imagen_principal: string | null }, { merge: false }>();
  if (error) return falloDeBase("No se pudo eliminar el producto", error);
  if (!data) return { ok: false, error: "Ese producto ya no existe." };

  if (data.imagen_principal) await borrarFotoSiHuerfana(supabase, data.imagen_principal);
  invalidarCatalogo();
  return { ok: true, referencia: data.referencia };
}
