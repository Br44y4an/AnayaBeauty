"use server";

import { obtenerProductoPorReferencia, obtenerProductos } from "@/lib/data/catalogo";
import type { OrdenCatalogo, PaginaProductos, Variante } from "@/lib/types";

/** «Ver más» no navega: pide la siguiente tanda y la añade, sin perder el scroll. */
export async function cargarMasProductos(filtros: {
  busqueda?: string;
  categoriaSlug?: string;
  orden?: OrdenCatalogo;
  pagina: number;
}): Promise<PaginaProductos> {
  return obtenerProductos({
    busqueda: filtros.busqueda,
    categoriaSlug: filtros.categoriaSlug,
    orden: filtros.orden,
    // La lista cuenta las tandas desde 0; obtenerProductos, desde 1.
    pagina: filtros.pagina + 1,
  });
}

/** Variantes de un producto, pedidas solo al abrir la hoja de selección. */
export async function cargarTonos(referencia: string): Promise<Variante[]> {
  return (await obtenerProductoPorReferencia(referencia))?.variantes ?? [];
}
