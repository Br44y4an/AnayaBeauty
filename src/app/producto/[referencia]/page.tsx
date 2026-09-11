import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerProductoPorReferencia } from "@/lib/data/catalog";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { FotoProducto } from "@/components/producto/FotoProducto";
import { IconoFlechaIzquierda } from "@/components/ui/Iconos";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ referencia: string }>;
}) {
  const { referencia } = await params;
  const producto = await obtenerProductoPorReferencia(decodeURIComponent(referencia));

  if (!producto) return { title: "Producto no encontrado — Anaya Beauty" };

  // El catálogo circula por WhatsApp: un título y una descripción propios
  // hacen que el enlace compartido muestre de qué producto se trata en
  // vez del nombre genérico de la tienda.
  return {
    title: `${producto.nombre} — Anaya Beauty`,
    description:
      producto.descripcion ??
      `${producto.nombre} (${producto.referencia}) en el catálogo de Anaya Beauty.`,
    openGraph: {
      title: producto.nombre,
      images: producto.imagenPrincipal ? [producto.imagenPrincipal] : [],
    },
  };
}

export default async function PaginaProducto({
  params,
}: {
  params: Promise<{ referencia: string }>;
}) {
  const { referencia } = await params;
  const producto = await obtenerProductoPorReferencia(decodeURIComponent(referencia));

  if (!producto) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32">
      <Link
        href="/"
        className="inline-flex min-h-[52px] cursor-pointer items-center gap-1.5 py-4
                   font-semibold text-lila-texto transition duration-200
                   hover:text-fucsia-texto"
      >
        <IconoFlechaIzquierda className="h-5 w-5" />
        Seguir viendo
      </Link>

      <FotoProducto src={producto.imagenPrincipal} alt={producto.nombre} />

      <div className="space-y-2 py-5">
        {producto.categoriaNombre && (
          <p className="text-sm font-semibold uppercase tracking-widest text-lila-texto">
            {producto.categoriaNombre}
          </p>
        )}

        <p className="text-sm font-bold tracking-widest text-carbon-suave">
          {producto.referencia}
        </p>

        <h1 className="font-display text-3xl leading-tight text-carbon">
          {producto.nombre}
        </h1>

        {producto.descripcion && (
          <p className="leading-relaxed text-carbon-suave">{producto.descripcion}</p>
        )}
      </div>

      <PanelCompra producto={producto} />
    </main>
  );
}
