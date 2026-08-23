import { Suspense } from "react";
import { obtenerProductos, obtenerCategorias } from "@/lib/data/catalog";
import { Encabezado } from "@/components/catalogo/Encabezado";
import { Buscador } from "@/components/catalogo/Buscador";
import { ChipsCategorias } from "@/components/catalogo/ChipsCategorias";
import { GrillaProductos } from "@/components/catalogo/GrillaProductos";

export const revalidate = 30;

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; orden?: string }>;
}) {
  const filtros = await searchParams;

  const [productos, categorias] = await Promise.all([
    obtenerProductos({
      busqueda: filtros.q,
      categoriaSlug: filtros.categoria,
      orden: filtros.orden as "precio-asc" | "precio-desc" | undefined,
    }),
    obtenerCategorias(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32">
      <Encabezado />

      <div className="sticky top-0 z-10 space-y-3 bg-rosa-nube/95 py-3 backdrop-blur">
        <Suspense fallback={<div className="h-[44px]" />}>
          <Buscador />
        </Suspense>
        <ChipsCategorias
          categorias={categorias}
          activa={filtros.categoria}
          busqueda={filtros.q}
        />
      </div>

      <GrillaProductos productos={productos} />

      <footer className="pt-16 text-center text-xs text-carbon-suave">
        Anaya Beauty · Belleza que te define
      </footer>
    </main>
  );
}
