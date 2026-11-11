"use server";

import { exigirAdmin } from "@/lib/admin/sesion";
import {
  cifrasDelPlan,
  describirCambio,
  idDeCategoria,
  planImportacion,
  type CamposImportados,
  type PlanImportacion,
} from "@/lib/admin/importacion";
import type { Resultado } from "@/lib/admin/resultado";
import { parsearCSV } from "@/lib/csv";
import { listarCategoriasAdmin, listarProductosAdmin } from "@/lib/data/admin-catalog";
import { invalidarCatalogo } from "@/lib/data/invalidar";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Categoria, Producto } from "@/lib/types";

// El servidor vuelve a leer el archivo y a calcular el plan al confirmar: no confía en lo que mande el navegador.

const LARGO_MAXIMO = 1_000_000;
const FILAS_MAXIMAS = 3000;
const EN_PARALELO = 8;

export type VistaPrevia = {
  /** Filas que no se pueden leer y no se importan. */
  errores: string[];
  avisos: string[];
  nuevos: { referencia: string; nombre: string; precio: number; stock: number }[];
  cambios: { referencia: string; nombre: string; lineas: string[] }[];
  sinCambios: number;
  cambianPrecio: number;
  quedanSinStock: number;
};

export type ResumenImportacion = { creados: number; actualizados: number; errores: string[] };

type Preparado = { plan: PlanImportacion; errores: string[]; categorias: Categoria[]; porReferencia: Map<string, Producto> };

async function preparar(texto: unknown): Promise<Preparado | { ok: false; error: string }> {
  if (typeof texto !== "string" || !texto.trim()) return { ok: false, error: "El archivo está vacío." };
  if (texto.length > LARGO_MAXIMO) {
    return { ok: false, error: "El archivo es muy grande. Divídelo en partes de hasta 3.000 productos." };
  }

  const { filas, errores } = parsearCSV(texto);
  if (filas.length > FILAS_MAXIMAS) {
    return { ok: false, error: "El archivo tiene más de 3.000 productos. Divídelo en partes." };
  }

  const [productos, categorias] = await Promise.all([
    listarProductosAdmin(undefined, { variantes: false }),
    listarCategoriasAdmin(),
  ]);
  const porReferencia = new Map(productos.map((p) => [p.referencia.toUpperCase(), p]));
  return { plan: planImportacion(filas, porReferencia, categorias), errores, categorias, porReferencia };
}

/** Lo que haría el archivo, sin escribir nada. */
export async function revisarImportacion(texto: string): Promise<Resultado<{ vista: VistaPrevia }>> {
  await exigirAdmin();
  const preparado = await preparar(texto);
  if ("ok" in preparado) return preparado;
  const { plan, errores, categorias, porReferencia } = preparado;

  return {
    ok: true,
    vista: {
      errores,
      avisos: plan.avisos,
      nuevos: plan.nuevos.map((f) => ({
        referencia: f.referencia,
        nombre: f.nombre ?? "",
        precio: f.escalones.find((e) => e.minCantidad === 1)?.precioUnitario ?? 0,
        stock: f.stock ?? 0,
      })),
      cambios: plan.cambios.map((c) => ({
        referencia: c.referencia,
        nombre: porReferencia.get(c.referencia)?.nombre ?? c.referencia,
        lineas: describirCambio(c, categorias),
      })),
      sinCambios: plan.sinCambios,
      ...cifrasDelPlan(plan),
    },
  };
}

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Se crean ocultos y se publican al final: un producto nunca queda a la venta sin precios. */
async function crearNuevos(supabase: Supabase, preparado: Preparado, publicar: boolean): Promise<number | string> {
  const { plan, categorias } = preparado;
  if (plan.nuevos.length === 0) return 0;

  const { data, error } = await supabase
    .from("products")
    .insert(
      plan.nuevos.map((f) => ({
        referencia: f.referencia,
        nombre: f.nombre,
        descripcion: f.descripcion,
        category_id: f.categoria ? idDeCategoria(f.categoria, categorias) : null,
        stock: f.stock ?? 0,
        activo: false,
      }))
    )
    .select("id, referencia");
  if (error) {
    console.error("[panel] No se pudieron crear los productos:", error);
    return error.code === "23505"
      ? "Alguna referencia nueva ya existe: vuelve a revisar el archivo."
      : `No se pudieron crear los productos nuevos. Detalle: ${error.message}`;
  }

  const idPorReferencia = new Map(data.map((p) => [p.referencia, p.id]));
  const ids = data.map((p) => p.id);
  const escalones = plan.nuevos.flatMap((f) =>
    f.escalones.map((e) => ({
      product_id: idPorReferencia.get(f.referencia),
      min_cantidad: e.minCantidad,
      precio_unitario: e.precioUnitario,
    }))
  );

  const { error: errorPrecios } = await supabase.from("price_tiers").insert(escalones);
  if (errorPrecios) {
    console.error("[panel] No se pudieron guardar los precios de los nuevos:", errorPrecios);
    await supabase.from("products").delete().in("id", ids);
    return `No se pudieron guardar los precios de los productos nuevos, así que no se creó ninguno. Detalle: ${errorPrecios.message}`;
  }

  if (publicar) {
    const { error: errorPublicar } = await supabase.from("products").update({ activo: true }).in("id", ids);
    if (errorPublicar) return `Los productos nuevos quedaron ocultos: no se pudieron publicar. Detalle: ${errorPublicar.message}`;
  }
  return ids.length;
}

/** Las columnas de `products` que cambian; los escalones van aparte, a `price_tiers`. */
function columnasDe({ nombre, descripcion, category_id, stock }: CamposImportados): Record<string, unknown> {
  return Object.fromEntries(Object.entries({ nombre, descripcion, category_id, stock }).filter(([, v]) => v !== undefined));
}

/** Solo las columnas que el archivo cambia; `activo` nunca. Devuelve los errores por referencia. */
async function actualizarExistentes(supabase: Supabase, plan: PlanImportacion): Promise<{ hechos: number; errores: string[] }> {
  const errores: string[] = [];
  const fallidos = new Set<string>();

  const conDatos = plan.cambios.filter((c) => Object.keys(columnasDe(c.campos)).length > 0);
  for (let i = 0; i < conDatos.length; i += EN_PARALELO) {
    await Promise.all(
      conDatos.slice(i, i + EN_PARALELO).map(async ({ id, referencia, campos }) => {
        const { error } = await supabase.from("products").update(columnasDe(campos)).eq("id", id);
        if (error) {
          fallidos.add(referencia);
          errores.push(`${referencia}: no se pudo actualizar (${error.message}).`);
        }
      })
    );
  }

  const precios = plan.cambios.flatMap((c) =>
    (c.campos.escalones ?? []).map((e) => ({ product_id: c.id, min_cantidad: e.minCantidad, precio_unitario: e.precioUnitario }))
  );
  if (precios.length > 0) {
    const { error } = await supabase.from("price_tiers").upsert(precios, { onConflict: "product_id,min_cantidad" });
    if (error) {
      console.error("[panel] No se pudieron actualizar los precios:", error);
      errores.push(`Los precios no se actualizaron. Detalle: ${error.message}`);
      plan.cambios.filter((c) => c.campos.escalones).forEach((c) => fallidos.add(c.referencia));
    }
  }

  return { hechos: plan.cambios.filter((c) => !fallidos.has(c.referencia)).length, errores };
}

export async function aplicarImportacion(
  texto: string,
  publicarNuevos: boolean
): Promise<Resultado<{ resumen: ResumenImportacion }>> {
  await exigirAdmin();
  const preparado = await preparar(texto);
  if ("ok" in preparado) return preparado;

  const supabase = await crearClienteServidor();
  const creados = await crearNuevos(supabase, preparado, publicarNuevos === true);
  const { hechos, errores } = await actualizarExistentes(supabase, preparado.plan);
  if (typeof creados === "string") errores.unshift(creados);

  invalidarCatalogo();
  return { ok: true, resumen: { creados: typeof creados === "number" ? creados : 0, actualizados: hechos, errores } };
}
