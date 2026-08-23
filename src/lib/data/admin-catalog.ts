import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import { mapearProducto, type FilaProducto } from "@/lib/data/catalog";
import type { Producto, Categoria } from "@/lib/types";

/**
 * Consultas del panel. A diferencia de las del catálogo público, estas
 * ven también los productos y categorías desactivados.
 */

const CAMPOS = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo,
  categories ( nombre ),
  price_tiers ( min_cantidad, precio_unitario )
`;

export async function listarProductosAdmin(busqueda?: string): Promise<Producto[]> {
  const supabase = clienteAdmin();
  let consulta = supabase.from("products").select(CAMPOS);

  if (busqueda?.trim()) {
    const t = `%${busqueda.trim()}%`;
    consulta = consulta.or(`nombre.ilike.${t},referencia.ilike.${t}`);
  }

  const { data, error } = await consulta.order("referencia").limit(500);
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  return (data as unknown as FilaProducto[]).map(mapearProducto);
}

export async function obtenerProductoAdmin(id: string): Promise<Producto | null> {
  const supabase = clienteAdmin();
  const { data } = await supabase.from("products").select(CAMPOS).eq("id", id).maybeSingle();

  return data ? mapearProducto(data as unknown as FilaProducto) : null;
}

export async function listarCategoriasAdmin(): Promise<Categoria[]> {
  const supabase = clienteAdmin();
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

export async function obtenerConfiguracion(): Promise<
  { clave: string; valor: string; publico: boolean }[]
> {
  const supabase = clienteAdmin();
  const { data } = await supabase
    .from("store_settings")
    .select("clave, valor, publico")
    .order("clave");

  return data ?? [];
}
