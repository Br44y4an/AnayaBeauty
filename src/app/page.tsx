import { Suspense } from "react";
import {
  obtenerProductos,
  obtenerCategorias,
  obtenerConfiguracionDePrecios,
  type OrdenCatalogo,
} from "@/lib/data/catalog";
import { Encabezado } from "@/components/catalogo/Encabezado";
import { Buscador } from "@/components/catalogo/Buscador";
import { ChipsCategorias } from "@/components/catalogo/ChipsCategorias";
import { OrdenProductos } from "@/components/catalogo/OrdenProductos";
import { ListaProductos } from "@/components/catalogo/ListaProductos";
import { CintaBeneficios } from "@/components/catalogo/CintaBeneficios";
import { Esqueleto } from "@/components/ui/Esqueleto";

export const revalidate = 30;

const ORDENES: OrdenCatalogo[] = ["destacados", "precio-asc", "precio-desc", "nuevos"];

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; orden?: string }>;
}) {
  const filtros = await searchParams;

  const orden: OrdenCatalogo = ORDENES.includes(filtros.orden as OrdenCatalogo)
    ? (filtros.orden as OrdenCatalogo)
    : "destacados";

  const [pagina, categorias, precios] = await Promise.all([
    obtenerProductos({
      busqueda: filtros.q,
      categoriaSlug: filtros.categoria,
      orden,
    }),
    obtenerCategorias(),
    obtenerConfiguracionDePrecios(),
  ]);

  return (
    <>
      <a href="#productos" className="salto-contenido">
        Saltar al catálogo
      </a>

      <main id="contenido" className="mx-auto max-w-6xl px-4 pb-32">
        <Encabezado />

        <CintaBeneficios
          reglas={precios.reglas}
          umbralPorMayor={precios.umbralPorMayor}
        />

        {/* Los filtros se quedan pegados arriba: en una lista larga,
            volver al principio solo para cambiar de categoría era el
            camino más rápido a abandonar el catálogo. */}
        <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-rosa-nube/95 px-4 py-3 backdrop-blur">
          <Suspense fallback={<Esqueleto className="h-[52px] w-full rounded-pastilla" />}>
            <Buscador />
          </Suspense>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ChipsCategorias
                categorias={categorias}
                activa={filtros.categoria}
                parametros={{ q: filtros.q, orden: filtros.orden }}
              />
            </div>

            <Suspense fallback={<Esqueleto className="h-12 w-40 rounded-pastilla" />}>
              <div className="hidden sm:block">
                <OrdenProductos actual={orden} />
              </div>
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <div className="sm:hidden">
              <OrdenProductos actual={orden} />
            </div>
          </Suspense>
        </div>

        <div id="productos" className="pt-4">
          <ListaProductos
            // La clave fuerza a empezar de cero cuando cambian los
            // filtros: sin ella la lista acumulada del filtro anterior
            // se quedaba pegada debajo de los resultados nuevos.
            key={`${filtros.q ?? ""}|${filtros.categoria ?? ""}|${orden}`}
            inicial={pagina.productos}
            total={pagina.total}
            hayMasInicial={pagina.hayMas}
            filtros={{
              busqueda: filtros.q,
              categoriaSlug: filtros.categoria,
              orden,
            }}
          />
        </div>

        <footer className="pt-16 text-center text-sm text-carbon-suave">
          Anaya Beauty · Belleza que te define
        </footer>
      </main>
    </>
  );
}
