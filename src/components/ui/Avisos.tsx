"use client";

import Image from "next/image";
import Link from "next/link";
import { estilosBoton } from "@/components/ui/Boton";
import { cerrarAviso, pausarAviso, reanudarAviso, useAvisoActual } from "@/lib/avisos";

const ACCION = estilosBoton({ variante: "secundario", tamano: "compacto", className: "shrink-0" });

// Un aviso a la vez, abajo y sobre el área segura; se apoya encima de un pie fijo vía --alto-pie-fijo
// (lo activa `data-pie-fijo`, ver globals.css). La región viva existe siempre para que el lector lo anuncie.
export function Avisos() {
  const aviso = useAvisoActual();
  const accion = aviso?.accion;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--alto-pie-fijo,0px)+env(safe-area-inset-bottom)+0.75rem)] z-[70] flex justify-center px-4"
    >
      {aviso && (
        <div
          key={aviso.id}
          onPointerEnter={pausarAviso}
          onPointerLeave={reanudarAviso}
          onFocus={pausarAviso}
          onBlur={reanudarAviso}
          className="pointer-events-auto flex w-full max-w-md animate-asomar items-center gap-3 rounded-md
                     bg-fondo p-3 shadow-flotante ring-1 ring-linea"
        >
          {aviso.imagen && (
            <div className="size-12 shrink-0 rounded-sm bg-superficie p-1">
              <Image
                src={aviso.imagen}
                alt=""
                width={48}
                height={48}
                sizes="48px"
                className="size-full object-contain mix-blend-multiply"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-5 text-tinta">{aviso.titulo}</p>
            {aviso.detalle && (
              <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-tinta-suave">{aviso.detalle}</p>
            )}
          </div>
          {accion?.href ? (
            <Link href={accion.href} onClick={cerrarAviso} className={ACCION}>
              {accion.etiqueta}
            </Link>
          ) : (
            accion && (
              <button
                type="button"
                onClick={() => {
                  accion.alHacer?.();
                  cerrarAviso();
                }}
                className={ACCION}
              >
                {accion.etiqueta}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
