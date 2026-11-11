import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import type { Producto } from "@/lib/types";

const MAXIMO = 8;

type Props = { productos: Producto[]; titulo: string; enModal: boolean };

/**
 * «Más de {categoría}» con la tarjeta compacta del catálogo. Dentro de la vista rápida los saltos
 * reemplazan la entrada del historial: así «Cerrar» sigue volviendo al catálogo y no al producto anterior.
 */
export function RielRelacionados({ productos, titulo, enModal }: Props) {
  if (productos.length === 0) return null;
  const Titulo = enModal ? "h3" : "h2";
  const id = `relacionados-${enModal ? "modal" : "pagina"}`;

  return (
    <section aria-labelledby={id} className="mt-10 border-t border-linea pt-8">
      <Titulo id={id} className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-tinta">
        {titulo}
      </Titulo>
      <ul
        className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1
                   [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-x-6 md:gap-y-8 md:overflow-visible
                   md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {productos.slice(0, MAXIMO).map((producto) => (
          <li key={producto.id} className="w-36 shrink-0 snap-start sm:w-40 md:w-auto">
            <TarjetaProducto producto={producto} compacta replace={enModal} />
          </li>
        ))}
      </ul>
    </section>
  );
}
