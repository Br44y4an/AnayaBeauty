import { crearClienteServidor } from "@/lib/supabase/server";
import { precioDesde } from "@/lib/pricing";
import type { Producto, Categoria } from "@/lib/types";

const CAMPOS_PRODUCTO = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo,
  categories ( nombre ),
  price_tiers ( min_cantidad, precio_unitario )
`;

type FilaEscalon = { min_cantidad: number; precio_unitario: number };

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
  let consulta = supabase.from("products").select(CAMPOS_PRODUCTO).eq("activo", true);

  if (opciones?.categoriaSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opciones.categoriaSlug)
      .maybeSingle();
    if (cat) consulta = consulta.eq("category_id", cat.id);
  }

  if (opciones?.busqueda?.trim()) {
    const termino = `%${opciones.busqueda.trim()}%`;
    consulta = consulta.or(`nombre.ilike.${termino},referencia.ilike.${termino}`);
  }

  const { data, error } = await consulta.order("orden").limit(500);
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  const productos = (data as unknown as FilaProducto[]).map(mapearProducto);

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
