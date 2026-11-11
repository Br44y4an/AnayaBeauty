import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import type { Producto } from "@/lib/types";

const MAXIMO = 12;

/**
 * Lo que la dueña marcó como destacado (solo sin filtros ni búsqueda). En el celular se desliza;
 * desde 1024 px es una fila fija de seis, porque con mouse no se puede deslizar.
 */
export function RielDestacados({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) return null;

  return (
    <section aria-labelledby="titulo-destacados" className="pb-8 pt-2">
      <h2 id="titulo-destacados" className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-tinta">
        Destacados
      </h2>
      <ul
        className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1
                   [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 lg:mx-0 lg:grid lg:grid-cols-6
                   lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {productos.slice(0, MAXIMO).map((producto, i) => (
          <li key={producto.id} className="w-36 shrink-0 snap-start sm:w-44 lg:w-auto lg:[&:nth-child(n+7)]:hidden">
            <TarjetaProducto producto={producto} indice={i} compacta />
          </li>
        ))}
      </ul>
    </section>
  );
}
