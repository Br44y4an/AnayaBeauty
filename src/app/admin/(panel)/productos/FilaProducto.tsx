import Image from "next/image";
import Link from "next/link";
import { precioUnitarioPara } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { pluralVariante } from "@/lib/variantes";
import { Insignia } from "@/components/ui/Insignia";
import type { Producto } from "@/lib/types";
import { AccionesFila } from "./AccionesFila";

/** Toda la fila abre el producto; las acciones van encima del enlace. */
export function FilaProducto({ producto: p, href }: { producto: Producto; href: string }) {
  const precio = p.escalones.length > 0 ? `${pesos(precioUnitarioPara(p.escalones, 1))} c/u` : null;
  const detalles = [
    p.categoriaNombre ?? "Sin categoría",
    precio,
    p.numVariantes > 0 ? pluralVariante(p.etiquetaVariante, p.numVariantes) : null,
    p.activo && p.stock <= 5 ? null : `${p.stock} en stock`,
  ].filter(Boolean);

  return (
    <li className="relative flex gap-3 py-3">
      <Link href={href} aria-label={`Editar ${p.nombre}, Ref. ${p.referencia}`} className="absolute inset-0 rounded-md" />
      <div className="pointer-events-none relative size-16 shrink-0 bg-superficie">
        {p.imagenPrincipal ? (
          <Image
            src={p.imagenPrincipal}
            alt=""
            fill
            sizes="64px"
            className="object-contain p-1 mix-blend-multiply"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-center text-xs leading-4 text-tinta-suave">
            Sin foto
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
            Ref. {p.referencia}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-5 text-tinta">{p.nombre}</p>
          <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">{detalles.join(" · ")}</p>
          <EstadoProducto producto={p} />
        </div>
        <div className="relative z-10 md:shrink-0">
          <AccionesFila id={p.id} nombre={p.nombre} activo={p.activo} destacado={p.destacado} />
        </div>
      </div>
    </li>
  );
}

function EstadoProducto({ producto: p }: { producto: Producto }) {
  const insignias = [
    !p.activo && <Insignia key="oculto">Oculto</Insignia>,
    p.activo && p.stock <= 0 && (
      <Insignia key="agotado" tono="alerta">
        Agotado
      </Insignia>
    ),
    p.activo && p.stock > 0 && p.stock <= 5 && (
      <Insignia key="quedan" tono="alerta">
        Quedan {p.stock}
      </Insignia>
    ),
    p.escalones.length === 0 && (
      <Insignia key="precio" tono="error">
        Sin precio
      </Insignia>
    ),
  ].filter(Boolean);

  return insignias.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{insignias}</div> : null;
}
