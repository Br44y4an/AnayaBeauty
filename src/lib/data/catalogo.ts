import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { clientePublico } from "@/lib/supabase/publico";
import { ETIQUETA, VERSION_DATOS } from "@/lib/data/etiquetas";
import { compactarReferencia, gruposDeBusqueda } from "@/lib/data/busqueda";
import { falla } from "@/lib/data/errores";
import { departamentoDe, idsDeCategoria } from "@/lib/categorias";
import { ordenDeParametro } from "@/lib/rutas";
import { ETIQUETAS_VARIANTE, resolverEtiqueta } from "@/lib/variantes";
import type { Escalon } from "@/lib/pricing";
import type {
  Categoria,
  EtiquetaVariante,
  OrdenCatalogo,
  PaginaProductos,
  Producto,
  SugerenciaProducto,
  Variante,
} from "@/lib/types";

// Lecturas públicas del catálogo: cliente sin cookies y caché por etiquetas.
// Las búsquedas de texto libre no se guardan (cada una es distinta).

export const POR_PAGINA = 24;
const PAGINA_MAXIMA = 10;
const LARGO_MAXIMO_BUSQUEDA = 80;
const CANDIDATOS_SUGERENCIA = 40;
const REVALIDAR = 300;

const CAMPOS_GRILLA = `
  id, referencia, nombre, descripcion, category_id, imagen_principal, galeria,
  stock, activo, destacado, etiqueta_variante, num_tonos,
  price_tiers ( min_cantidad, precio_unitario )
`;
const CAMPOS_FICHA = `${CAMPOS_GRILLA}, product_shades ( id, nombre, color_hex, orden, agotado )`;
// Una RPC con select solo se puede ordenar por columnas de ese select: con otra, PostgREST
// responde 42703. Por eso las búsquedas piden también las columnas de COLUMNAS_ORDEN.
const CAMPOS_BUSQUEDA = `${CAMPOS_GRILLA}, orden, created_at, precio_base`;
const CAMPOS_SUGERENCIA =
  "id, orden, referencia, nombre, imagen_principal, precio_base, num_tonos, category_id, etiqueta_variante";

export type FilaEscalon = { min_cantidad: number; precio_unitario: number };

export type FilaVariante = {
  id: string;
  nombre: string;
  color_hex: string;
  orden: number;
  agotado?: boolean | null;
};

export type FilaCategoria = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  categoria_padre_id: string | null;
  etiqueta_variante?: string | null;
};

/** Las columnas de la v5 son opcionales: el panel todavía no las pide todas. */
export type FilaProducto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  category_id: string | null;
  imagen_principal: string | null;
  galeria: string[] | null;
  stock: number;
  activo: boolean;
  destacado?: boolean | null;
  etiqueta_variante?: string | null;
  num_tonos?: number | null;
  price_tiers: FilaEscalon[] | null;
  product_shades?: FilaVariante[] | null;
};

type FilaSugerencia = {
  referencia: string;
  nombre: string;
  imagen_principal: string | null;
  precio_base: number | null;
  num_tonos: number | null;
  category_id: string | null;
  etiqueta_variante: string | null;
};

function etiquetaValida(v: string | null | undefined): EtiquetaVariante | null {
  return ETIQUETAS_VARIANTE.find((e) => e === v) ?? null;
}

export function mapearCategoria(f: FilaCategoria): Categoria {
  return {
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    orden: f.orden,
    categoriaPadreId: f.categoria_padre_id,
    etiquetaVariante: etiquetaValida(f.etiqueta_variante),
  };
}

export function mapearEscalones(filas: FilaEscalon[] | null): Escalon[] {
  return (filas ?? [])
    .map((e) => ({ minCantidad: e.min_cantidad, precioUnitario: e.precio_unitario }))
    .sort((a, b) => a.minCantidad - b.minCantidad);
}

/** En el orden guardado, que es el de la foto. */
export function mapearVariantes(filas: FilaVariante[]): Variante[] {
  return filas
    .map((f) => ({ id: f.id, nombre: f.nombre, colorHex: f.color_hex, orden: f.orden, agotado: f.agotado ?? false }))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

/** Etiqueta de un producto: la suya, la de su categoría, la del departamento o la de por defecto. */
export function etiquetaDeFila(
  fila: { category_id: string | null; etiqueta_variante?: string | null },
  categorias: Categoria[]
): EtiquetaVariante {
  const categoria = categorias.find((c) => c.id === fila.category_id);
  const departamento = departamentoDe(fila.category_id, categorias);
  return resolverEtiqueta({
    producto: etiquetaValida(fila.etiqueta_variante),
    categoria: categoria?.etiquetaVariante ?? null,
    departamento: departamento?.etiquetaVariante ?? null,
    slugDepartamento: departamento?.slug ?? null,
  });
}

export function mapearProducto(fila: FilaProducto, categorias: Categoria[]): Producto {
  const categoria = categorias.find((c) => c.id === fila.category_id);
  // Si la consulta trajo las variantes, su número manda: `num_tonos` lo
  // mantiene un disparador y puede ir un instante atrás tras editarlas.
  const variantes = fila.product_shades ? mapearVariantes(fila.product_shades) : null;

  return {
    id: fila.id,
    referencia: fila.referencia,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoriaId: fila.category_id,
    categoriaNombre: categoria?.nombre ?? null,
    categoriaSlug: categoria?.slug ?? null,
    imagenPrincipal: fila.imagen_principal,
    galeria: fila.galeria ?? [],
    stock: fila.stock,
    activo: fila.activo,
    destacado: fila.destacado ?? false,
    escalones: mapearEscalones(fila.price_tiers),
    etiquetaVariante: etiquetaDeFila(fila, categorias),
    numVariantes: variantes ? variantes.length : (fila.num_tonos ?? 0),
    variantes,
  };
}

export const obtenerCategorias: () => Promise<Categoria[]> = unstable_cache(
  async () => {
    const { data, error } = await clientePublico()
      .from("categories")
      .select("id, nombre, slug, orden, categoria_padre_id, etiqueta_variante")
      .eq("activo", true)
      .order("orden")
      .order("nombre")
      .overrideTypes<FilaCategoria[], { merge: false }>();

    if (error) falla("catalogo", "No se pudieron cargar las categorías", error);
    return (data ?? []).map(mapearCategoria);
  },
  ["categorias", VERSION_DATOS],
  { tags: [ETIQUETA.catalogo], revalidate: REVALIDAR }
);

type Opciones = { ascending: boolean; nullsFirst?: boolean };
type Ordenable<T> = { order(columna: string, opciones: Opciones): T };

/** `precio_base` es el precio que se muestra; `id` desempata para que las páginas no se solapen. */
const COLUMNAS_ORDEN: Record<OrdenCatalogo, [string, Opciones][]> = {
  destacados: [["orden", { ascending: true }], ["created_at", { ascending: false }]],
  "precio-asc": [["precio_base", { ascending: true, nullsFirst: false }]],
  "precio-desc": [["precio_base", { ascending: false, nullsFirst: false }]],
  nuevos: [["created_at", { ascending: false }]],
};

function ordenar<T extends Ordenable<T>>(consulta: T, orden: OrdenCatalogo): T {
  let ordenada = consulta;
  for (const [columna, opciones] of COLUMNAS_ORDEN[orden]) ordenada = ordenada.order(columna, opciones);
  return ordenada.order("id", { ascending: true });
}

type Filtros = {
  categoriaSlug: string | null;
  busqueda: string;
  orden: OrdenCatalogo;
  pagina: number;
  hastaPagina: boolean;
};

async function consultarPagina(f: Filtros): Promise<PaginaProductos> {
  const vacia = { productos: [], total: 0, pagina: f.pagina, porPagina: POR_PAGINA };
  const categorias = await obtenerCategorias();
  const ids = f.categoriaSlug ? idsDeCategoria(f.categoriaSlug, categorias) : null;
  const grupos = gruposDeBusqueda(f.busqueda);

  // Un slug desconocido no muestra el catálogo entero, ni una búsqueda sin palabras útiles.
  if ((f.categoriaSlug && !ids) || (f.busqueda && grupos.length === 0)) return vacia;

  const supabase = clientePublico();
  const desde = f.hastaPagina ? 0 : (f.pagina - 1) * POR_PAGINA;
  const hasta = f.pagina * POR_PAGINA - 1;

  const consulta = grupos.length
    ? ordenar(
        supabase
          .rpc("buscar_productos", { p_grupos: grupos, p_categorias: ids }, { count: "exact" })
          .select(CAMPOS_BUSQUEDA),
        f.orden
      )
    : ordenar(
        ids
          ? supabase.from("products").select(CAMPOS_GRILLA, { count: "exact" }).eq("activo", true).in("category_id", ids)
          : supabase.from("products").select(CAMPOS_GRILLA, { count: "exact" }).eq("activo", true),
        f.orden
      );

  const { data, error, count } = await consulta.range(desde, hasta);

  // PGRST103: se pidió una página después de la última (el catálogo se encogió).
  if (error?.code === "PGRST103") return { ...vacia, total: desde };
  if (error) falla("catalogo", "No se pudieron cargar los productos", error);

  // Sin tipos generados, `rpc().select()` se tipa como «fila o lista»: siempre es lista.
  const filas: FilaProducto[] = Array.isArray(data) ? data : [];
  const productos = filas.map((fila) => mapearProducto(fila, categorias));
  return { productos, total: count ?? productos.length, pagina: f.pagina, porPagina: POR_PAGINA };
}

const paginaEnCache = unstable_cache(consultarPagina, ["productos", VERSION_DATOS], {
  tags: [ETIQUETA.catalogo],
  revalidate: REVALIDAR,
});

/** `hastaPagina`: trae de la primera a la página pedida (al volver con `?pagina=N`). */
export function obtenerProductos(o: {
  categoriaSlug?: string | null;
  busqueda?: string | null;
  orden?: OrdenCatalogo;
  pagina?: number;
  hastaPagina?: boolean;
}): Promise<PaginaProductos> {
  const filtros: Filtros = {
    categoriaSlug: o.categoriaSlug?.trim() || null,
    busqueda: (o.busqueda ?? "").trim().slice(0, LARGO_MAXIMO_BUSQUEDA),
    orden: ordenDeParametro(o.orden),
    pagina: Math.min(PAGINA_MAXIMA, Math.max(1, Math.floor(Number(o.pagina) || 1))),
    hastaPagina: o.hastaPagina === true,
  };
  return filtros.busqueda ? consultarPagina(filtros) : paginaEnCache(filtros);
}

const destacadosEnCache = unstable_cache(
  async (limite: number): Promise<Producto[]> => {
    const [categorias, { data, error }] = await Promise.all([
      obtenerCategorias(),
      clientePublico()
        .from("products")
        .select(CAMPOS_GRILLA)
        .eq("activo", true)
        .eq("destacado", true)
        .gt("stock", 0)
        .order("orden")
        .order("id")
        .limit(limite)
        .overrideTypes<FilaProducto[], { merge: false }>(),
    ]);

    if (error) falla("catalogo", "No se pudieron cargar los destacados", error);
    return (data ?? []).map((fila) => mapearProducto(fila, categorias));
  },
  ["destacados", VERSION_DATOS],
  { tags: [ETIQUETA.catalogo], revalidate: REVALIDAR }
);

/** Lo que la dueña marcó como destacado y se puede comprar hoy. */
export function obtenerDestacados(limite = 12): Promise<Producto[]> {
  return destacadosEnCache(Math.min(24, Math.max(1, Math.floor(limite))));
}

const fichaEnCache = unstable_cache(
  async (referencia: string): Promise<Producto | null> => {
    const [categorias, { data, error }] = await Promise.all([
      obtenerCategorias(),
      clientePublico()
        .from("products")
        .select(CAMPOS_FICHA)
        .eq("referencia", referencia)
        .eq("activo", true)
        .maybeSingle()
        .overrideTypes<FilaProducto, { merge: false }>(),
    ]);

    if (error) falla("catalogo", "No se pudo cargar el producto", error);
    return data ? mapearProducto(data, categorias) : null;
  },
  ["ficha", VERSION_DATOS],
  { tags: [ETIQUETA.catalogo], revalidate: REVALIDAR }
);

/** Con variantes. Recibe la referencia YA decodificada (`decodificarReferencia`): decodificar dos veces
 * rompe «100%». `cache()` la comparte con generateMetadata. */
export const obtenerProductoPorReferencia = cache(
  (referencia: string): Promise<Producto | null> =>
    referencia ? fichaEnCache(referencia) : Promise.resolve(null)
);

const relacionadosEnCache = unstable_cache(
  async (productoId: string, categoriaId: string, limite: number): Promise<Producto[]> => {
    const categorias = await obtenerCategorias();
    const departamento = departamentoDe(categoriaId, categorias);
    const ids = departamento ? idsDeCategoria(departamento.slug, categorias) : null;
    if (!ids) return [];

    const { data, error } = await clientePublico()
      .from("products")
      .select(CAMPOS_GRILLA)
      .eq("activo", true)
      .gt("stock", 0)
      .in("category_id", ids)
      .neq("id", productoId)
      .order("orden")
      .order("id")
      .limit(limite * 3)
      .overrideTypes<FilaProducto[], { merge: false }>();

    if (error) falla("catalogo", "No se pudieron cargar los productos relacionados", error);
    const productos = (data ?? []).map((fila) => mapearProducto(fila, categorias));
    const mismaCategoria = productos.filter((p) => p.categoriaId === categoriaId);
    return [...mismaCategoria, ...productos.filter((p) => p.categoriaId !== categoriaId)].slice(0, limite);
  },
  ["relacionados", VERSION_DATOS],
  { tags: [ETIQUETA.catalogo], revalidate: REVALIDAR }
);

/** «Más de {categoría}»: primero la misma categoría y después su departamento, con stock. */
export function obtenerRelacionados(p: Producto, limite = 8): Promise<Producto[]> {
  if (!p.categoriaId) return Promise.resolve([]);
  return relacionadosEnCache(p.id, p.categoriaId, Math.min(24, Math.max(1, Math.floor(limite))));
}

/** Hasta `limite` sugerencias con la referencia exacta primero, y cuántas hay en total. */
export async function obtenerSugerencias(
  q: string,
  limite = 8
): Promise<{ total: number; productos: SugerenciaProducto[] }> {
  const texto = q.trim().slice(0, LARGO_MAXIMO_BUSQUEDA);
  const grupos = texto.length >= 2 ? gruposDeBusqueda(texto) : [];
  if (grupos.length === 0) return { total: 0, productos: [] };

  const [categorias, { data, error, count }] = await Promise.all([
    obtenerCategorias(),
    clientePublico()
      .rpc("buscar_productos", { p_grupos: grupos }, { count: "exact" })
      .select(CAMPOS_SUGERENCIA)
      .order("orden")
      .order("id")
      .range(0, CANDIDATOS_SUGERENCIA - 1),
  ]);

  if (error) falla("catalogo", "No se pudieron cargar las sugerencias", error);
  const filas: FilaSugerencia[] = Array.isArray(data) ? data : [];
  const buscada = compactarReferencia(texto);
  const esExacta = (f: FilaSugerencia) => compactarReferencia(f.referencia) === buscada;

  return {
    total: count ?? filas.length,
    productos: [...filas.filter(esExacta), ...filas.filter((f) => !esExacta(f))]
      .slice(0, Math.max(1, limite))
      .map((f) => ({
        referencia: f.referencia,
        nombre: f.nombre,
        imagenPrincipal: f.imagen_principal,
        precioBase: f.precio_base,
        numVariantes: f.num_tonos ?? 0,
        etiquetaVariante: etiquetaDeFila(f, categorias),
      })),
  };
}
