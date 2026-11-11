"use server";

import { refresh } from "next/cache";
import { exigirAdmin } from "@/lib/admin/sesion";
import { moverCategoria as calcularMovimiento, ordenAlFinal, validarCategoria } from "@/lib/admin/categorias";
import type { Resultado } from "@/lib/admin/resultado";
import { mapearCategoria, type FilaCategoria } from "@/lib/data/catalogo";
import { invalidarCatalogo } from "@/lib/data/invalidar";
import { esUuid } from "@/lib/ids";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;
type Fallo = { ok: false; error: string };

function falloDeBase(mensaje: string, error: { message: string }): Fallo {
  console.error(`[panel] ${mensaje}:`, error);
  return { ok: false, error: `${mensaje}. Intenta otra vez. Detalle: ${error.message}` };
}

/** Todas, también las ocultas: el orden y los dos niveles se calculan sobre la lista completa. */
async function leerCategorias(supabase: Supabase): Promise<Categoria[] | Fallo> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, nombre, slug, orden, categoria_padre_id, etiqueta_variante")
    .overrideTypes<FilaCategoria[], { merge: false }>();
  return error ? falloDeBase("No se pudieron leer las categorías", error) : (data ?? []).map(mapearCategoria);
}

function despuesDeEscribir() {
  invalidarCatalogo();
  refresh();
}

export async function guardarCategoria(datos: FormData): Promise<Resultado<{ id: string; nombre: string }>> {
  await exigirAdmin();
  const id = String(datos.get("id") ?? "").trim() || null;
  if (id !== null && !esUuid(id)) return { ok: false, error: "Esta categoría no es válida. Recarga la página." };

  const supabase = await crearClienteServidor();
  const categorias = await leerCategorias(supabase);
  if (!Array.isArray(categorias)) return categorias;
  const actual = id ? categorias.find((c) => c.id === id) : null;
  if (id && !actual) return { ok: false, error: "Esta categoría ya no existe. Recarga la página." };

  const validada = validarCategoria(
    {
      id,
      nombre: String(datos.get("nombre") ?? ""),
      madreId: String(datos.get("categoria_padre_id") ?? ""),
      etiqueta: String(datos.get("etiqueta_variante") ?? ""),
    },
    categorias
  );
  if (!validada.ok) return validada;
  const c = validada.categoria;

  const fila = { nombre: c.nombre, categoria_padre_id: c.categoriaPadreId, etiqueta_variante: c.etiquetaVariante };
  // Al cambiar de nivel entra al final del nuevo; el slug nunca cambia: está en los enlaces que ya circulan.
  const cambiaDeNivel = !actual || actual.categoriaPadreId !== c.categoriaPadreId;
  const orden = cambiaDeNivel ? { orden: ordenAlFinal(categorias, c.categoriaPadreId) } : {};

  const { data, error } = actual
    ? await supabase.from("categories").update({ ...fila, ...orden }).eq("id", actual.id).select("id").single()
    : await supabase
        .from("categories")
        .insert({ ...fila, ...orden, slug: c.slug, activo: true })
        .select("id")
        .single();

  if (error?.code === "23505") {
    return { ok: false, error: "Revisa los campos marcados.", campos: { nombre: "Ya existe una categoría con ese nombre." } };
  }
  if (error?.message.includes("CATEGORIA_PROFUNDIDAD")) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      campos: { categoria_padre_id: "Solo hay dos niveles: elige un departamento que no esté dentro de otro." },
    };
  }
  if (error) return falloDeBase("No se pudo guardar la categoría", error);

  despuesDeEscribir();
  return { ok: true, id: data.id, nombre: c.nombre };
}

/** Sube o baja una posición entre las de su nivel: es el orden de las pestañas de la tienda. */
export async function moverCategoria(id: string, paso: -1 | 1): Promise<Resultado> {
  await exigirAdmin();
  if (!esUuid(id) || (paso !== -1 && paso !== 1)) return { ok: false, error: "No se pudo mover la categoría." };

  const supabase = await crearClienteServidor();
  const categorias = await leerCategorias(supabase);
  if (!Array.isArray(categorias)) return categorias;

  const cambios = calcularMovimiento(categorias, id, paso);
  const resultados = await Promise.all(
    cambios.map(({ id: cambiada, orden }) => supabase.from("categories").update({ orden }).eq("id", cambiada))
  );
  const fallo = resultados.find((r) => r.error)?.error;
  if (fallo) return falloDeBase("No se pudo cambiar el orden", fallo);

  despuesDeEscribir();
  return { ok: true };
}

/** Ocultar la saca de las pestañas de la tienda; sus productos siguen a la venta. */
export async function cambiarVisibilidadCategoria(id: string, activo: boolean): Promise<Resultado> {
  await exigirAdmin();
  if (!esUuid(id)) return { ok: false, error: "Esta categoría no es válida." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categories")
    .update({ activo: activo === true })
    .eq("id", id)
    .select("id");
  if (error) return falloDeBase("No se pudo cambiar la categoría", error);
  if (!data?.length) return { ok: false, error: "Esta categoría ya no existe. Recarga la página." };

  despuesDeEscribir();
  return { ok: true };
}
