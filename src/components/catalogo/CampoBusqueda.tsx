"use client";

import { IconoBuscar } from "@/components/ui/Iconos";
import { abrirBusqueda } from "@/lib/busqueda-rapida";

type Props = {
  /** La búsqueda vigente (`?q=`): se muestra en el campo y la búsqueda abre con ella. */
  texto?: string;
  /** 44 px de alto (cabecera); por defecto 52 px. */
  compacto?: boolean;
  className?: string;
};

/** Botón con aspecto de campo que abre la búsqueda rápida. */
export function CampoBusqueda({ texto = "", compacto = false, className = "" }: Props) {
  const actual = texto.trim();

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => abrirBusqueda(actual)}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-md border border-borde bg-fondo px-3.5
                  text-left text-base leading-6 transition-colors duration-150 hover:border-tinta
                  ${compacto ? "min-h-11" : "min-h-13"} ${className}`}
    >
      <IconoBuscar tamano={22} className="shrink-0 text-tinta" />
      {actual ? (
        <span className="min-w-0 truncate text-tinta">
          <span className="sr-only">Buscar: </span>
          {actual}
        </span>
      ) : (
        <span className="min-w-0 truncate text-tinta-suave">Busca por nombre o referencia</span>
      )}
    </button>
  );
}

/** La lupa de la cabecera en el celular. */
export function BotonBuscar({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Buscar"
      aria-haspopup="dialog"
      onClick={() => abrirBusqueda()}
      className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta
                  transition-colors duration-150 hover:bg-superficie ${className}`}
    >
      <IconoBuscar />
    </button>
  );
}
