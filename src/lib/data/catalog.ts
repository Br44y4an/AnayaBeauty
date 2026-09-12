import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Producto, Categoria, Tono } from "@/lib/types";
import type { ReglaDescuento } from "@/lib/discounts";
import { filtroBusqueda } from "@/lib/data/busqueda";

/**
 * Consultas públicas del catálogo (solo productos activos).
 *
 * DOS DECISIONES QUE VALE LA PENA ENTENDER
 *
 * 1. La grilla NO trae los tonos. Un producto puede tener 40, y con 591
 *    productos eso eran decenas de miles de filas por pantalla para
 *    pintar unos círculos que la clienta casi nunca quería mirar. Ahora
 *    solo viaja `num_tonos`, y los tonos se piden con
 *    `obtenerTonosDeProducto` al abrir la hoja de selección.
 *
 * 2. La grilla se pagina en la base, no en memoria. Antes se traía la
 *    tabla entera para poder ordenarla por precio, porque el precio vive
 *    en `price_tiers` y no en `products`. La migración v4 añadió las
 *    columnas `precio_desde` / `precio_base`, mantenidas por disparador,
 *    y con eso el orden y el corte los hace PostgreSQL.
 */

/** Cuántos productos entran en cada tanda del catálogo. */
export const POR_PAGINA = 24;

const CAMPOS_GRILLA = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo, num_tonos,
  categories ( nombre ),
  price_tiers ( min_cantidad, precio_unitario )
`;

const CAMPOS_DETALLE = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo, num_tonos,
  categories ( nombre ),
  price_tiers ( min_cantidad, precio_unitario ),
  product_shades ( id, nombre, color_hex, orden )
`;

type FilaEscalon = { min_cantidad: number; precio_unitario: number };
type FilaTono = { id: string; nombre: string; color_hex: string; orden: number };

export type FilaProducto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  category_id: string | null;
  categories: { nombre: string } | { nombre: string }[] | null;
  imagen_principal: string | null;
  galeria: string[] | null;
  stock: number;
  activo: boolean;
  num_tonos?: number | null;
  price_tiers: FilaEscalon[] | null;
  product_shades?: FilaTono[] | null;
};

export function mapearTono(t: FilaTono): Tono {
  return { id: t.id, nombre: t.nombre, colorHex: t.color_hex, orden: t.orden };
}

export function ordenarTonos(tonos: Tono[]): Tono[] {
  return [...tonos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

export function mapearProducto(fila: FilaProducto): Producto {
  const categoria = Array.isArray(fila.categories) ? fila.categories[0] : fila.categories;
  const tonos = ordenarTonos((fila.product_shades ?? []).map(mapearTono));

  return {
    id: fila.id,
    referencia: fila.referencia,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoriaId: fila.category_id,
    categoriaNombre: categoria?.nombre ?? null,
    imagenPrincipal: fila.imagen_principal,
    galeria: fila.galeria ?? [],
    stock: fila.stock,
    activo: fila.activo,
    escalones: (fila.price_tiers ?? [])
      .map((e) => ({ minCantidad: e.min_cantidad, precioUnitario: e.precio_unitario }))
      .sort((a, b) => a.minCantidad - b.minCantidad),
    // Cuando la consulta sí trajo los tonos, ese conteo manda: es el dato
    // fresco. `num_tonos` lo mantiene un disparador y podría ir un
    // instante por detrás justo después de editar la paleta.
    numTonos: tonos.length || (fila.num_tonos ?? 0),
    tonos,
  };
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categories")
    .select("id, nombre, slug, orden, categoria_padre_id")
    .eq("activo", true)
    .order("orden");

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    slug: c.slug,
    orden: c.orden,
    categoriaPadreId: c.categoria_padre_id,
  }));
}

export type OrdenCatalogo = "destacados" | "precio-asc" | "precio-desc" | "nuevos";

export type PaginaProductos = {
  productos: Producto[];
  /** Cuántos hay en total con estos filtros (para "12 de 340"). */
  total: number;
  /** Si queda otra tanda por pedir. */
  hayMas: boolean;
  pagina: number;
};

export async function obtenerProductos(opciones?: {
  categoriaSlug?: string;
  busqueda?: string;
  orden?: OrdenCatalogo;
  /** Base 0. */
  pagina?: number;
  porPagina?: number;
}): Promise<PaginaProductos> {
  const supabase = await crearClienteServidor();

  const pagina = Math.max(0, Math.floor(opciones?.pagina ?? 0));
  const porPagina = Math.min(60, Math.max(1, opciones?.porPagina ?? POR_PAGINA));

  let categoriaId: string | null = null;
  if (opciones?.categoriaSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opciones.categoriaSlug)
      .maybeSingle();

    // Slug que no existe: mejor una lista vacía con su mensaje que el
    // catálogo completo, que haría pensar que el filtro no funciona.
    if (!cat) return { productos: [], total: 0, hayMas: false, pagina };
    categoriaId = cat.id;
  }

  let consulta = supabase
    .from("products")
    .select(CAMPOS_GRILLA, { count: "exact" })
    .eq("activo", true);

  if (categoriaId) consulta = consulta.eq("category_id", categoriaId);
  if (opciones?.busqueda?.trim()) consulta = consulta.or(filtroBusqueda(opciones.busqueda));

  // `nullsFirst: false` deja al final los productos todavía sin precio,
  // que son borradores: nadie quiere abrir el catálogo y encontrárselos.
  switch (opciones?.orden) {
    case "precio-asc":
      consulta = consulta.order("precio_desde", { ascending: true, nullsFirst: false });
      break;
    case "precio-desc":
      consulta = consulta.order("precio_desde", { ascending: false, nullsFirst: false });
      break;
    case "nuevos":
      consulta = consulta.order("created_at", { ascending: false });
      break;
    default:
      consulta = consulta.order("orden").order("created_at", { ascending: false });
  }

  // Desempate estable: sin él dos productos con el mismo precio pueden
  // cambiar de sitio entre página y página y salir repetidos o perdidos.
  consulta = consulta.order("id", { ascending: true });

  const desde = pagina * porPagina;
  const { data, error, count } = await consulta.range(desde, desde + porPagina - 1);

  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  const productos = ((data ?? []) as unknown as FilaProducto[]).map(mapearProducto);
  const total = count ?? productos.length;

  return {
    productos,
    total,
    hayMas: desde + productos.length < total,
    pagina,
  };
}

/**
 * `cache()`: la página de producto pide este mismo producto dos veces
 * en cada visita —una vez en `generateMetadata`, otra al renderizar—
 * y sin memoizar eso eran dos viajes a Supabase por carga, con la
 * clienta esperando el segundo de puro trámite. `cache()` hace que la
 * segunda llamada con la misma referencia, dentro del mismo request,
 * reuse el resultado de la primera en vez de repetir la consulta.
 */
export const obtenerProductoPorReferencia = cache(async function obtenerProductoPorReferencia(
  referencia: string
): Promise<Producto | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .select(CAMPOS_DETALLE)
    .eq("referencia", referencia)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  return data ? mapearProducto(data as unknown as FilaProducto) : null;
});

/**
 * Tonos de un solo producto, para la hoja de selección.
 * Es la contrapartida de haberlos sacado de la consulta de la grilla.
 */
export async function obtenerTonosDeProducto(productoId: string): Promise<Tono[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productoId)) {
    return [];
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("product_shades")
    .select("id, nombre, color_hex, orden")
    .eq("product_id", productoId)
    .order("orden");

  if (error) throw new Error(`No se pudieron cargar los tonos: ${error.message}`);
  return ordenarTonos((data ?? []).map(mapearTono));
}

export async function obtenerConfiguracionPublica(): Promise<Record<string, string>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("store_settings")
    .select("clave, valor")
    .eq("publico", true);
  return Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor]));
}

/** Reglas de descuento activas, ordenadas de mayor a menor monto. */
export async function obtenerReglasDescuento(): Promise<ReglaDescuento[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("discount_rules")
    .select("monto_minimo, porcentaje")
    .eq("activo", true)
    .order("monto_minimo", { ascending: false });

  return (data ?? []).map((r) => ({
    montoMinimo: r.monto_minimo,
    porcentaje: r.porcentaje,
  }));
}

/** Todo lo que el carrito necesita para calcular totales igual que el servidor. */
export async function obtenerConfiguracionDePrecios(): Promise<{
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
}> {
  const [reglas, config] = await Promise.all([
    obtenerReglasDescuento(),
    obtenerConfiguracionPublica(),
  ]);

  return {
    reglas,
    umbralPorMayor: Number(config.umbral_por_mayor ?? 200000),
  };
}
