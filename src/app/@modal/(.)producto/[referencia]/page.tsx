import type { Metadata } from "next";
import { FichaProducto, metadataDeProducto } from "@/components/producto/FichaProducto";
import { ProductoNoDisponible } from "@/components/producto/ProductoNoDisponible";
import { obtenerProductoPorReferencia } from "@/lib/data/catalogo";
import { decodificarReferencia } from "@/lib/rutas";

export const revalidate = 300;

export function generateStaticParams(): { referencia: string }[] {
  return [];
}

type Props = { params: Promise<{ referencia: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadataDeProducto((await params).referencia);
}

/** Vista rápida: el enlace de una tarjeta abre la ficha en una hoja sobre la tienda. */
export default async function VistaRapida({ params }: Props) {
  const referencia = decodificarReferencia((await params).referencia);
  const producto = referencia ? await obtenerProductoPorReferencia(referencia) : null;

  // Sin notFound(): el not-found de la raíz se pintaría en el hueco del slot, no dentro de la hoja.
  return producto ? <FichaProducto producto={producto} variante="modal" /> : <ProductoNoDisponible />;
}
