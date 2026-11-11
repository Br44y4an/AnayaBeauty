import "server-only";
import { exigirAdmin } from "@/lib/admin/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";
import {
  mapearCategoria,
  mapearProducto,
  type FilaCategoria,
  type FilaProducto,
} from "@/lib/data/catalogo";
import { traerTodas } from "@/lib/data/paginacion";
import { filtroBusqueda } from "@/lib/data/busqueda";
import { falla } from "@/lib/data/errores";
import { esUuid } from "@/lib/ids";
import { ETIQUETAS_VARIANTE } from "@/lib/variantes";
import type { Producto, Categoria, EtiquetaVariante } from "@/lib/types";

// Consultas del panel: a diferencia de las del catálogo público, ven también lo oculto.
// Usan la clave de servicio, así que cada una exige primero una administradora.

const CAMPOS_LISTA = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo, destacado, etiqueta_variante, num_tonos,
  price_tiers ( min_cantidad, precio_unitario )
`;
const CAMPOS = `${CAMPOS_LISTA}, product_shades ( id, nombre, color_hex, orden, agotado )`;
const CAMPOS_CATEGORIA = "id, nombre, slug, orden, categoria_padre_id, etiqueta_variante, activo";

type FilaCategoriaPanel = FilaCategoria & { activo: boolean };

/** Categoría tal como la edita el panel: con su estado y cuántos productos tiene. */
export type CategoriaPanel = Categoria & { activo: boolean; numProductos: number };

/** `etiquetaPropia` es la guardada en el producto; null = «Según la categoría». */
export type ProductoPanel = Producto & { etiquetaPropia: EtiquetaVariante | null };

/** Todas, también las ocultas: el nombre y la etiqueta de cada producto salen de aquí. */
async function todasLasCategorias(): Promise<FilaCategoriaPanel[]> {
  const { data, error } = await clienteAdmin()
    .from("categories")
    .select(CAMPOS_CATEGORIA)
    .order("orden")
    .order("nombre")
    .overrideTypes<FilaCategoriaPanel[], { merge: false }>();

  if (error) falla("panel", "No se pudieron cargar las categorías", error);
  return data ?? [];
}

/** `variantes: false` para la lista, que solo muestra cuántas hay; los recibos sí las necesitan. */
export async function listarProductosAdmin(
  busqueda?: string,
  { variantes = true }: { variantes?: boolean } = {}
): Promise<Producto[]> {
  await exigirAdmin();
  const supabase = clienteAdmin();
  const campos = variantes ? CAMPOS : CAMPOS_LISTA;

  // Una consulta nueva por página: los builders de PostgREST son de un solo uso.
  const paginaDe = (desde: number, hasta: number) => {
    let consulta = supabase.from("products").select(campos);
    if (busqueda?.trim()) consulta = consulta.or(filtroBusqueda(busqueda));
    return consulta.order("referencia").range(desde, hasta).overrideTypes<FilaProducto[], { merge: false }>();
  };

  const [filas, categorias] = await Promise.all([
    traerTodas<FilaProducto>(paginaDe).catch((e: Error) => falla("panel", "No se pudieron cargar los productos", e)),
    todasLasCategorias(),
  ]);

  const mapeadas = categorias.map(mapearCategoria);
  return filas.map((fila) => mapearProducto(fila, mapeadas));
}

export async function obtenerProductoAdmin(id: string): Promise<ProductoPanel | null> {
  await exigirAdmin();
  if (!esUuid(id)) return null;

  const [{ data, error }, categorias] = await Promise.all([
    clienteAdmin()
      .from("products")
      .select(CAMPOS)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<FilaProducto, { merge: false }>(),
    todasLasCategorias(),
  ]);

  if (error) falla("panel", "No se pudo cargar el producto", error);
  if (!data) return null;
  const etiquetaPropia = ETIQUETAS_VARIANTE.find((e) => e === data.etiqueta_variante) ?? null;
  return { ...mapearProducto(data, categorias.map(mapearCategoria)), etiquetaPropia };
}

/** Todas las categorías, también las ocultas, con el número de productos de cada una. */
export async function listarCategoriasAdmin(): Promise<CategoriaPanel[]> {
  await exigirAdmin();
  const supabase = clienteAdmin();

  const [filas, usos] = await Promise.all([
    todasLasCategorias(),
    traerTodas<{ category_id: string | null }>((desde, hasta) =>
      supabase
        .from("products")
        .select("category_id")
        .order("id")
        .range(desde, hasta)
        .overrideTypes<{ category_id: string | null }[], { merge: false }>()
    ).catch((e: Error) => falla("panel", "No se pudieron contar los productos", e)),
  ]);

  const cuenta = new Map<string, number>();
  for (const { category_id } of usos) {
    if (category_id) cuenta.set(category_id, (cuenta.get(category_id) ?? 0) + 1);
  }

  return filas.map((f) => ({ ...mapearCategoria(f), activo: f.activo, numProductos: cuenta.get(f.id) ?? 0 }));
}

export async function obtenerConfiguracion(): Promise<{ clave: string; valor: string; publico: boolean }[]> {
  await exigirAdmin();
  const { data, error } = await clienteAdmin()
    .from("store_settings")
    .select("clave, valor, publico")
    .order("clave")
    .overrideTypes<{ clave: string; valor: string; publico: boolean }[], { merge: false }>();

  if (error) falla("panel", "No se pudieron cargar los ajustes", error);
  return data ?? [];
}

/** Reglas de descuento, incluidas las desactivadas. */
export async function listarReglasDescuento(): Promise<
  { id: string; montoMinimo: number; porcentaje: number; activo: boolean }[]
> {
  await exigirAdmin();
  const { data, error } = await clienteAdmin()
    .from("discount_rules")
    .select("id, monto_minimo, porcentaje, activo")
    .order("monto_minimo")
    .overrideTypes<{ id: string; monto_minimo: number; porcentaje: number; activo: boolean }[], { merge: false }>();

  if (error) falla("panel", "No se pudieron cargar las reglas de descuento", error);
  return (data ?? []).map((r) => ({
    id: r.id,
    montoMinimo: r.monto_minimo,
    porcentaje: r.porcentaje,
    activo: r.activo,
  }));
}
