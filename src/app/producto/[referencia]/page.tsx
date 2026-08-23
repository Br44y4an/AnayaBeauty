import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerProductoPorReferencia } from "@/lib/data/catalog";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { IconoFlechaIzquierda, IconoCorazon } from "@/components/ui/Iconos";

export const revalidate = 30;

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
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 py-4
                   text-sm font-semibold text-lila transition duration-200 hover:text-fucsia
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia"
      >
        <IconoFlechaIzquierda className="h-4 w-4" />
        Seguir viendo
      </Link>

      <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-petalo shadow-petalo">
        {producto.imagenPrincipal ? (
          <Image
            src={producto.imagenPrincipal}
            alt={producto.nombre}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-lila-suave">
            <IconoCorazon className="h-16 w-16" />
          </div>
        )}
      </div>

      <div className="space-y-2 py-5">
        {producto.categoriaNombre && (
          <p className="text-xs font-semibold uppercase tracking-widest text-lila">
            {producto.categoriaNombre}
          </p>
        )}

        <p className="text-xs font-bold tracking-widest text-carbon-suave">
          {producto.referencia}
        </p>

        <h1 className="font-display text-3xl leading-tight text-carbon">
          {producto.nombre}
        </h1>

        {producto.descripcion && (
          <p className="text-sm leading-relaxed text-carbon-suave">
            {producto.descripcion}
          </p>
        )}
      </div>

      <PanelCompra producto={producto} />
    </main>
  );
}
