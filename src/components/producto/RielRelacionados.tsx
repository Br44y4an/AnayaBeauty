import Image from "next/image";
import Link from "next/link";
import { pesos } from "@/lib/format";
import { rutaProducto } from "@/lib/rutas";
import type { Producto } from "@/lib/types";

const MAXIMO = 8;

type Props = { productos: Producto[]; titulo: string; enModal: boolean };

/**
 * «Más de {categoría}». Dentro de la vista rápida los saltos reemplazan la entrada del historial:
 * así «Cerrar» sigue volviendo al catálogo y no al producto anterior.
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
        {productos.slice(0, MAXIMO).map((producto) => {
          const precio = producto.escalones[0]?.precioUnitario;
          return (
            <li key={producto.id} className="w-36 shrink-0 snap-start sm:w-40 md:w-auto">
              <Link href={rutaProducto(producto.referencia)} replace={enModal} scroll={false} className="block rounded-sm">
                <div className="relative aspect-square bg-superficie">
                  {producto.imagenPrincipal ? (
                    <Image
                      src={producto.imagenPrincipal}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 240px, 160px"
                      className="object-contain p-[6%] mix-blend-multiply"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] text-tinta-suave">
                      Sin foto
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-tinta">{producto.nombre}</p>
                {precio !== undefined && (
                  <p className="mt-1 text-[15px] font-bold leading-5 tabular-nums text-tinta">
                    {pesos(precio)} <span className="text-[13px] font-normal text-tinta-suave">c/u</span>
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
