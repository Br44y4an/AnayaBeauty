"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { estilosBoton } from "@/components/ui/Boton";
import { cerrarAviso, pausarAviso, reanudarAviso, useAvisoActual } from "@/lib/avisos";

const ACCION = estilosBoton({ variante: "secundario", tamano: "compacto", className: "shrink-0" });
const PIE_FIJO = "[data-pie-fijo]";
const VARIABLE = "--alto-pie-fijo";

/** Alto del pie más alto que de verdad tapa el borde de abajo; uno sin fijar (bolsa en escritorio) no cuenta. */
function altoMayor(pies: HTMLElement[]): number {
  return pies.reduce((alto, pie) => {
    const { position } = getComputedStyle(pie);
    if (position !== "fixed" && position !== "sticky") return alto;
    return Math.max(alto, Math.ceil(pie.getBoundingClientRect().height));
  }, 0);
}

// Pone en <html> --alto-pie-fijo con el alto del pie fijo más alto (ficha, bolsa) y lo sigue al cambiar de
// tamaño, aparecer o perder la marca. Sin pies marcados quita la variable y vuelve el valor de globals.css.
function useAltoPieFijo() {
  useEffect(() => {
    const raiz = document.documentElement;
    let pies: HTMLElement[] = [];
    const medir = () => {
      if (pies.length === 0) raiz.style.removeProperty(VARIABLE);
      else raiz.style.setProperty(VARIABLE, `${altoMayor(pies)}px`);
    };
    const tamanos = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    const revisar = () => {
      const actuales = [...document.querySelectorAll<HTMLElement>(PIE_FIJO)];
      if (actuales.length === pies.length && actuales.every((pie, i) => pie === pies[i])) return;
      pies = actuales;
      tamanos?.disconnect();
      for (const pie of pies) tamanos?.observe(pie, { box: "border-box" });
      medir();
    };
    const cambios = new MutationObserver(revisar);
    cambios.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-pie-fijo"],
    });
    revisar();
    return () => {
      cambios.disconnect();
      tamanos?.disconnect();
      raiz.style.removeProperty(VARIABLE);
    };
  }, []);
}

// Un aviso a la vez, abajo, sobre el pie fijo si lo hay (su alto ya incluye el área segura) o sobre el área
// segura. La región viva existe siempre para que el lector lo anuncie.
export function Avisos() {
  const aviso = useAvisoActual();
  const accion = aviso?.accion;
  useAltoPieFijo();

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(var(--alto-pie-fijo,0px),env(safe-area-inset-bottom))+0.75rem)]
                 z-[70] flex justify-center px-4"
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
