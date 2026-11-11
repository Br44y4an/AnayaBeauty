import type { Categoria, Producto } from "@/lib/types";

export type FiltroProductos = "todos" | "activos" | "ocultos" | "agotados" | "sin-foto" | "destacados";

export const FILTROS_PRODUCTOS: readonly { valor: FiltroProductos; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "ocultos", etiqueta: "Ocultos" },
  { valor: "agotados", etiqueta: "Agotados" },
  { valor: "sin-foto", etiqueta: "Sin foto" },
  { valor: "destacados", etiqueta: "Destacados" },
];

/** Valor del filtro de categoría para los productos que no tienen ninguna. */
export const SIN_CATEGORIA = "sin-categoria";

const CUMPLE: Record<FiltroProductos, (p: Producto) => boolean> = {
  todos: () => true,
  activos: (p) => p.activo,
  ocultos: (p) => !p.activo,
  // «Agotado» es lo que ve la clienta: visible y sin unidades.
  agotados: (p) => p.activo && p.stock <= 0,
  "sin-foto": (p) => !p.imagenPrincipal,
  destacados: (p) => p.destacado,
};

/** `?filtro=` llega de la URL: cualquier valor desconocido es «todos». */
export function filtroDeParametro(valor: string | null | undefined): FiltroProductos {
  return FILTROS_PRODUCTOS.find((f) => f.valor === valor)?.valor ?? "todos";
}

/** La categoría elegida y, si es un departamento y se pasan las categorías, sus hijas. */
function enCategoria(categoriaId: string, categorias: Categoria[]): (p: Producto) => boolean {
  if (categoriaId === SIN_CATEGORIA) return (p) => p.categoriaId === null;
  const ids = new Set([categoriaId, ...categorias.filter((c) => c.categoriaPadreId === categoriaId).map((c) => c.id)]);
  return (p) => p.categoriaId !== null && ids.has(p.categoriaId);
}

export function filtrarProductosAdmin(
  productos: Producto[],
  filtro: FiltroProductos,
  categoriaId?: string | null,
  categorias: Categoria[] = []
): Producto[] {
  const cumple = CUMPLE[filtro];
  const dentro = categoriaId ? enCategoria(categoriaId, categorias) : () => true;
  return productos.filter((p) => cumple(p) && dentro(p));
}

/** Cuántos productos hay en cada filtro, dentro de la categoría elegida. */
export function contarPorFiltro(
  productos: Producto[],
  categoriaId?: string | null,
  categorias: Categoria[] = []
): Record<FiltroProductos, number> {
  const dentro = filtrarProductosAdmin(productos, "todos", categoriaId, categorias);
  const cuenta = Object.fromEntries(FILTROS_PRODUCTOS.map((f) => [f.valor, 0])) as Record<FiltroProductos, number>;
  for (const p of dentro) {
    for (const { valor } of FILTROS_PRODUCTOS) if (CUMPLE[valor](p)) cuenta[valor]++;
  }
  return cuenta;
}

/** Lo que la lista lleva en la URL; el formulario lo recibe igual para volver al mismo punto. */
export type EstadoLista = { q: string; filtro: FiltroProductos; categoria: string; pagina: number };

type Parametro = string | string[] | undefined;

export function estadoLista(p: Record<string, Parametro>): EstadoLista {
  const uno = (v: Parametro) => (Array.isArray(v) ? v[0] : v) ?? "";
  return {
    q: uno(p.q).trim().slice(0, 80),
    filtro: filtroDeParametro(uno(p.filtro)),
    categoria: uno(p.categoria).trim(),
    pagina: Math.max(1, Math.floor(Number(uno(p.pagina))) || 1),
  };
}

function consulta(e: EstadoLista, extra: Record<string, string> = {}): string {
  const parametros = new URLSearchParams();
  if (e.q) parametros.set("q", e.q);
  if (e.filtro !== "todos") parametros.set("filtro", e.filtro);
  if (e.categoria) parametros.set("categoria", e.categoria);
  if (e.pagina > 1) parametros.set("pagina", String(e.pagina));
  for (const [clave, valor] of Object.entries(extra)) parametros.set(clave, valor);
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}

export function urlListaProductos(e: EstadoLista, extra?: Record<string, string>): string {
  return `/admin/productos${consulta(e, extra)}`;
}

export function urlEditarProducto(id: string, e: EstadoLista): string {
  return `/admin/productos/${id}${consulta(e)}`;
}
