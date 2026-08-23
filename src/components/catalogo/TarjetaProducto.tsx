import Image from "next/image";
import Link from "next/link";
import { precioDesde } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { Insignia } from "@/components/ui/Insignia";
import { IconoCorazon } from "@/components/ui/Iconos";
import type { Producto } from "@/lib/types";

export function TarjetaProducto({ producto }: { producto: Producto }) {
  const sinStock = producto.stock === 0;
  const quedaPoco = producto.stock > 0 && producto.stock <= 5;
  const desde = producto.escalones.length ? precioDesde(producto.escalones) : null;
  const tieneCombo = producto.escalones.length > 1;

  return (
    <Link
      href={`/producto/${producto.referencia}`}
      aria-label={`${producto.nombre}, referencia ${producto.referencia}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-tarjeta
                 bg-petalo shadow-petalo transition duration-200 hover:shadow-flotante
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia
                 focus-visible:ring-offset-2 focus-visible:ring-offset-rosa-nube"
    >
      <div className="relative aspect-square bg-rosa-nube">
        {producto.imagenPrincipal ? (
          <Image
            src={producto.imagenPrincipal}
            alt={producto.nombre}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-lila-suave">
            <IconoCorazon className="h-10 w-10" />
          </div>
        )}

        {tieneCombo && !sinStock && (
          <span
            className="absolute left-2 top-2 rounded-pastilla bg-lila px-2.5 py-1
                       text-[10px] font-bold uppercase tracking-wide text-petalo"
          >
            Combo
          </span>
        )}

        {sinStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-petalo/80">
            <span className="font-display text-lg text-carbon-suave">Agotado</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] font-bold tracking-wide text-lila">
          {producto.referencia}
        </p>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-carbon">
          {producto.nombre}
        </h3>

        <div className="mt-auto pt-2">
          {desde !== null && (
            <p className="text-base font-bold text-fucsia">
              <span className="text-[11px] font-normal text-carbon-suave">desde </span>
              {pesos(desde)}
            </p>
          )}

          {quedaPoco && (
            <p className="pt-1">
              <Insignia tono="alerta">Quedan {producto.stock}</Insignia>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
