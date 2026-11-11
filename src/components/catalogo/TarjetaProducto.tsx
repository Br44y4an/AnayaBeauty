"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { memo, useId } from "react";
import { AgregarRapido } from "@/components/catalogo/AgregarRapido";
import { Giro } from "@/components/ui/Giro";
import { Insignia } from "@/components/ui/Insignia";
import { pesos } from "@/lib/format";
import { rutaProducto } from "@/lib/rutas";
import type { Escalon } from "@/lib/pricing";
import type { Producto } from "@/lib/types";

// Grilla de 2/3/4 columnas dentro de 1200 px; el riel usa teselas de 144–176 px.
const TAMANOS_GRILLA = "(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 288px";
const TAMANOS_RIEL = "176px";

/**
 * La tarjeta ocupa 5 filas de la grilla (subgrid): nombre, precio y botón quedan alineados con los de
 * su fila sin reservar alturas. La celda usa la misma clase; la grilla no lleva gap vertical (se heredaría).
 */
export const CELDA_TARJETA = "row-span-5 grid min-w-0 grid-cols-1 grid-rows-subgrid gap-y-0";

type Props = {
  producto: Producto;
  /** Posición en pantalla: las primeras fotos se piden ya, sin esperar al scroll. */
  indice?: number;
  /** Versión del riel: foto, nombre y precio; toda la tarjeta abre la ficha. */
  compacta?: boolean;
};

/** Precio de una unidad y el escalón siguiente, si se puede alcanzar con el stock. */
function preciosDeTarjeta(escalones: Escalon[], stock: number) {
  const [primero, segundo] = [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);
  if (!primero) return null;
  return {
    unidad: primero.precioUnitario,
    siguiente: segundo && segundo.minCantidad <= stock ? segundo : null,
  };
}

function TarjetaProductoBase({ producto, indice = Number.POSITIVE_INFINITY, compacta = false }: Props) {
  const idNombre = useId();
  const precios = preciosDeTarjeta(producto.escalones, producto.stock);
  const agotado = producto.stock <= 0;

  const foto = (
    <div className="relative aspect-square bg-superficie">
      {producto.imagenPrincipal ? (
        <Image
          src={producto.imagenPrincipal}
          alt=""
          fill
          sizes={compacta ? TAMANOS_RIEL : TAMANOS_GRILLA}
          loading={indice < 4 ? "eager" : "lazy"}
          fetchPriority={indice < 2 ? "high" : "auto"}
          className="object-contain p-[6%] mix-blend-multiply"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[13px] leading-[18px] text-tinta-suave">
          Sin foto
        </span>
      )}
      {agotado && (
        <span className="absolute bottom-2 left-2">
          <Insignia>Agotado</Insignia>
        </span>
      )}
      <PistaCarga />
    </div>
  );

  if (compacta) {
    return (
      <article aria-labelledby={idNombre}>
        <Link href={rutaProducto(producto.referencia)} className="block rounded-sm">
          {foto}
          <p id={idNombre} className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-tinta">
            {producto.nombre}
          </p>
          {precios && (
            <p className="mt-1 text-[15px] font-bold leading-5 text-tinta tabular-nums">
              {pesos(precios.unidad)} <span className="text-[13px] font-normal text-tinta-suave">c/u</span>
            </p>
          )}
        </Link>
      </article>
    );
  }

  // Cinco hijos, siempre (aunque alguno vaya vacío): son las filas de CELDA_TARJETA.
  return (
    <article aria-labelledby={idNombre} className={CELDA_TARJETA}>
      <Link href={rutaProducto(producto.referencia)} className="block rounded-sm">
        {foto}
        {producto.categoriaNombre && (
          <p className="mt-2.5 truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-firma">
            {producto.categoriaNombre}
          </p>
        )}
        <p id={idNombre} className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-5 text-tinta">
          {producto.nombre}
        </p>
      </Link>
      <p className="mt-0.5 truncate text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
        {`Ref. ${producto.referencia}`}
      </p>
      {precios ? (
        <p className="mt-1.5 flex items-baseline gap-1 tabular-nums">
          <span className="text-[17px] font-bold leading-[22px] text-tinta">{pesos(precios.unidad)}</span>
          <span className="text-[13px] leading-[18px] text-tinta-suave">c/u</span>
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-5 text-tinta-suave">Precio por confirmar</p>
      )}
      <p className="text-[13px] leading-[18px] text-tinta-suave tabular-nums">
        {precios?.siguiente &&
          `${precios.siguiente.minCantidad} o más: ${pesos(precios.siguiente.precioUnitario)} c/u`}
      </p>
      <div className="pt-2.5">
        {precios && !agotado && <AgregarRapido producto={producto} idNombre={idNombre} />}
      </div>
    </article>
  );
}

/** Si el toque llega antes de que la ficha esté lista, la foto lo reconoce sin mover nada. */
function PistaCarga() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-fondo/60 text-tinta
                  transition-opacity duration-150 ${pending ? "opacity-100 delay-100" : "opacity-0"}`}
    >
      {pending && <Giro className="size-6" />}
    </span>
  );
}

export const TarjetaProducto = memo(TarjetaProductoBase);
