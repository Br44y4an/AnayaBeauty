import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaProducto, metadataDeProducto } from "@/components/producto/FichaProducto";
import { obtenerProductoPorReferencia } from "@/lib/data/catalogo";
import { decodificarReferencia } from "@/lib/rutas";

// ISR: cada ficha se genera la primera vez que se pide y se invalida por la etiqueta «catalogo».
export const revalidate = 300;

export function generateStaticParams(): { referencia: string }[] {
  return [];
}

type Props = { params: Promise<{ referencia: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadataDeProducto((await params).referencia);
}

/** Carga directa, recarga o enlace de WhatsApp. Desde la tienda, el mismo enlace abre la vista rápida. */
// Sin loading.tsx a propósito: notFound() solo responde 404 si ocurre fuera de todo Suspense (con
// esqueleto se envía 200 + noindex). Por eso tampoco puede haber un loading.tsx en (tienda)/ que la envuelva.
export default async function PaginaProducto({ params }: Props) {
  const referencia = decodificarReferencia((await params).referencia);
  const producto = referencia ? await obtenerProductoPorReferencia(referencia) : null;
  if (!producto) notFound();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 md:px-6">
      <FichaProducto producto={producto} variante="pagina" />
    </main>
  );
}
