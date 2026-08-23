"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { mapearProducto, type FilaProducto } from "@/lib/data/catalog";
import type { Producto } from "@/lib/types";

export async function cargarProductosDelCarrito(ids: string[]): Promise<Producto[]> {
  if (ids.length === 0) return [];

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, referencia, nombre, descripcion, category_id,
      imagen_principal, galeria, stock, activo,
      categories ( nombre ),
      price_tiers ( min_cantidad, precio_unitario )
    `
    )
    .in("id", ids)
    .eq("activo", true);

  if (error) throw new Error(`No se pudo cargar el carrito: ${error.message}`);
  return (data as unknown as FilaProducto[]).map(mapearProducto);
}
