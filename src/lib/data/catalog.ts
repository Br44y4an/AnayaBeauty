import { crearClienteServidor } from "@/lib/supabase/server";
import { precioDesde } from "@/lib/pricing";
import type { Producto, Categoria } from "@/lib/types";
import type { ReglaDescuento } from "@/lib/discounts";
import { traerTodas } from "@/lib/data/paginacion";

const CAMPOS_PRODUCTO = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo,
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
  price_tiers: FilaEscalon[] | null;
  product_shades?: FilaTono[] | null;
};

export function mapearProducto(fila: FilaProducto): Producto {
  const categoria = Array.isArray(fila.categories) ? fila.categories[0] : fila.categories;

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
    tonos: (fila.product_shades ?? [])
      .map((t) => ({
        id: t.id,
        nombre: t.nombre,
        colorHex: t.color_hex,
        orden: t.orden,
      }))
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
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

export async function obtenerProductos(opciones?: {
  categoriaSlug?: string;
  busqueda?: string;
  orden?: "recientes" | "precio-asc" | "precio-desc";
}): Promise<Producto[]> {
  const supabase = await crearClienteServidor();

  let categoriaId: string | null = null;
  if (opciones?.categoriaSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opciones.categoriaSlug)
      .maybeSingle();
    categoriaId = cat?.id ?? null;
  }

  // Se arma una consulta nueva por página: los builders de PostgREST son
  // mutables y de un solo uso, reutilizar el mismo entre páginas es frágil.
  const paginaDe = (desde: number, hasta: number) => {
    let consulta = supabase.from("products").select(CAMPOS_PRODUCTO).eq("activo", true);
    if (categoriaId) consulta = consulta.eq("category_id", categoriaId);
    if (opciones?.busqueda?.trim()) {
      const termino = `%${opciones.busqueda.trim()}%`;
      consulta = consulta.or(`nombre.ilike.${termino},referencia.ilike.${termino}`);
    }
    return consulta.order("orden").range(desde, hasta);
  };

  // Paginado: con `.limit()` fijo los productos que sobran del tope se caen
  // del catálogo en silencio a medida que crece la tienda.
  const filas = await traerTodas<FilaProducto>(paginaDe).catch((e: Error) => {
    throw new Error(`No se pudieron cargar los productos: ${e.message}`);
  });

  const productos = filas.map(mapearProducto);

  // El orden por precio se hace en memoria porque el precio surge de los
  // escalones, no de una columna de la tabla de productos.
  if (opciones?.orden === "precio-asc" || opciones?.orden === "precio-desc") {
    const signo = opciones.orden === "precio-asc" ? 1 : -1;
    productos.sort((a, b) => {
      const pa = a.escalones.length ? precioDesde(a.escalones) : 0;
      const pb = b.escalones.length ? precioDesde(b.escalones) : 0;
      return (pa - pb) * signo;
    });
  }

  return productos;
}

export async function obtenerProductoPorReferencia(
  referencia: string
): Promise<Producto | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .select(CAMPOS_PRODUCTO)
    .eq("referencia", referencia)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  return data ? mapearProducto(data as unknown as FilaProducto) : null;
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
