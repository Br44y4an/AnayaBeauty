"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { generarSlug } from "@/lib/slug";
import type { FilaCSV } from "@/lib/csv";

export type ResumenImportacion = {
  creados: number;
  actualizados: number;
  errores: string[];
};

export async function importarProductos(filas: FilaCSV[]): Promise<ResumenImportacion> {
  const supabase = await crearClienteServidor();
  const errores: string[] = [];
  let creados = 0;
  let actualizados = 0;

  // Las categorías se resuelven una sola vez, no fila por fila
  const nombresCategoria = [...new Set(filas.map((f) => f.categoria).filter(Boolean))];
  const mapaCategorias = new Map<string, string>();

  for (const nombre of nombresCategoria) {
    const { data } = await supabase
      .from("categories")
      .upsert({ nombre, slug: generarSlug(nombre) }, { onConflict: "slug" })
      .select("id")
      .single();

    if (data) mapaCategorias.set(nombre, data.id);
  }

  // Qué referencias ya existían, para saber si se crea o se actualiza
  const { data: existentes } = await supabase
    .from("products")
    .select("referencia")
    .in(
      "referencia",
      filas.map((f) => f.referencia)
    );

  const yaExistian = new Set((existentes ?? []).map((p) => p.referencia));

  for (const fila of filas) {
    const { data: producto, error } = await supabase
      .from("products")
      .upsert(
        {
          referencia: fila.referencia,
          nombre: fila.nombre,
          descripcion: fila.descripcion || null,
          category_id: mapaCategorias.get(fila.categoria) ?? null,
          stock: fila.stock,
          activo: true,
        },
        { onConflict: "referencia" }
      )
      .select("id")
      .single();

    if (error || !producto) {
      errores.push(`${fila.referencia}: ${error?.message ?? "no se pudo guardar"}`);
      continue;
    }

    await supabase.from("price_tiers").delete().eq("product_id", producto.id);

    const { error: errorEscalones } = await supabase.from("price_tiers").insert(
      fila.escalones.map((e) => ({
        product_id: producto.id,
        min_cantidad: e.minCantidad,
        precio_unitario: e.precioUnitario,
      }))
    );

    if (errorEscalones) {
      errores.push(`${fila.referencia}: precios no guardados (${errorEscalones.message})`);
      continue;
    }

    if (yaExistian.has(fila.referencia)) actualizados++;
    else creados++;
  }

  revalidatePath("/admin/productos");
  revalidatePath("/");

  return { creados, actualizados, errores };
}
