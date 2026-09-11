"use server";

import {
  obtenerProductos,
  obtenerTonosDeProducto,
  type OrdenCatalogo,
  type PaginaProductos,
} from "@/lib/data/catalog";
import type { Tono } from "@/lib/types";

/**
 * Acciones del catálogo que se llaman desde el navegador.
 *
 * "Ver más" no navega: pide la siguiente tanda y la añade a la lista. Así
 * la clienta no pierde el sitio ni el scroll, que es justo lo que hace
 * abandonar un catálogo largo en el celular.
 */
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
    pagina: filtros.pagina,
  });
}

/**
 * Tonos de un producto, pedidos solo al abrir la hoja de selección.
 *
 * La grilla dejó de traerlos: con 591 productos y paletas de 30 colores
 * eran decenas de miles de filas por pantalla para pintar unos círculos
 * que casi nadie quería mirar.
 */
export async function cargarTonos(productoId: string): Promise<Tono[]> {
  return obtenerTonosDeProducto(productoId);
}
