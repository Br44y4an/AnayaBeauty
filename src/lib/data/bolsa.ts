import "server-only";
import { clientePublico } from "@/lib/supabase/publico";
import { esUuid } from "@/lib/ids";
import {
  etiquetaDeFila,
  mapearEscalones,
  mapearVariantes,
  obtenerCategorias,
  type FilaEscalon,
  type FilaVariante,
} from "@/lib/data/catalogo";
import { obtenerConfiguracionDePrecios } from "@/lib/data/configuracion";
import type { DatosBolsa, ProductoBolsa } from "@/lib/types";

type FilaCarrito = {
  id: string;
  referencia: string;
  nombre: string;
  imagen_principal: string | null;
  stock: number;
  activo: boolean;
  escalones: FilaEscalon[] | null;
};

type FilaExtra = {
  id: string;
  category_id: string | null;
  etiqueta_variante: string | null;
  product_shades: FilaVariante[] | null;
};

function falla(mensaje: string, error: { message: string }): never {
  console.error(`[bolsa] ${mensaje}:`, error);
  throw new Error(`${mensaje}.`);
}

/**
 * Datos frescos para la bolsa, sin caché: stock y precio salen de
 * `productos_del_carrito`, que también ve los productos ocultos (para decir
 * «ya no está disponible» en vez de borrarlos en silencio).
 */
export async function obtenerDatosBolsa(ids: string[]): Promise<DatosBolsa> {
  const limpios = [...new Set(ids)].filter(esUuid);
  const [precios, categorias] = await Promise.all([obtenerConfiguracionDePrecios(), obtenerCategorias()]);
  if (limpios.length === 0) return { productos: [], ...precios };

  const supabase = clientePublico();
  const [carrito, extras] = await Promise.all([
    supabase.rpc("productos_del_carrito", { p_ids: limpios }),
    // Variantes y etiqueta: solo de los activos; los ocultos no se pueden pedir.
    supabase
      .from("products")
      .select("id, category_id, etiqueta_variante, product_shades ( id, nombre, color_hex, orden, agotado )")
      .in("id", limpios)
      .overrideTypes<FilaExtra[], { merge: false }>(),
  ]);

  if (carrito.error) falla("No se pudo cargar tu bolsa", carrito.error);
  if (extras.error) falla("No se pudieron cargar las variantes de tu bolsa", extras.error);

  // La RPC sin tipos generados devuelve `any`: aquí se fija la forma esperada.
  const filas: FilaCarrito[] = carrito.data ?? [];
  const extraDe = new Map((extras.data ?? []).map((e) => [e.id, e]));
  const productos = filas.map((f): ProductoBolsa => {
    const extra = extraDe.get(f.id);
    return {
      id: f.id,
      referencia: f.referencia,
      nombre: f.nombre,
      imagenPrincipal: f.imagen_principal,
      stock: f.stock,
      activo: f.activo,
      escalones: mapearEscalones(f.escalones),
      etiquetaVariante: etiquetaDeFila(extra ?? { category_id: null }, categorias),
      variantes: mapearVariantes(extra?.product_shades ?? []),
    };
  });

  return { productos, ...precios };
}
