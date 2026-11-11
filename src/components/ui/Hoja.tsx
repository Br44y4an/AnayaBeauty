"use client";

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";
import { IconoCerrar } from "@/components/ui/Iconos";
import { useBloquearScroll } from "@/hooks/useBloquearScroll";
import { usePresencia } from "@/hooks/usePresencia";

type Props = {
  /** Por defecto true: así funciona también montada y desmontada desde fuera (uso de la v4). */
  abierta?: boolean;
  alCerrar: () => void;
  titulo: string;
  tituloVisible?: boolean;
  descripcion?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
  ancho?: "normal" | "amplio";
  pantallaCompleta?: boolean;
};

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo modal: sube desde abajo en el celular y se centra desde 768 px. Atrapa el tabulador, cierra con
// Escape y devuelve el foco a quien la abrió. El foco inicial va a `[data-autofocus]` o, si no hay, al panel.
export function Hoja({
  abierta = true,
  alCerrar,
  titulo,
  tituloVisible = true,
  descripcion,
  pie,
  children,
  ancho = "normal",
  pantallaCompleta = false,
}: Props) {
  const { montada, saliendo } = usePresencia(abierta);
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useBloquearScroll(montada);

  const alPulsar = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      alCerrar();
    } else if (evento.key === "Tab" && panel.current) {
      atraparTabulador(evento, panel.current);
    }
  });

  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodo = panel.current;
    if (nodo && !nodo.contains(document.activeElement)) {
      (nodo.querySelector<HTMLElement>("[data-autofocus]") ?? nodo).focus({ preventScroll: true });
    }
    const oyente = (evento: KeyboardEvent) => alPulsar(evento);
    document.addEventListener("keydown", oyente);
    return () => {
      document.removeEventListener("keydown", oyente);
      if (previo?.isConnected && !nodo?.contains(previo)) previo.focus({ preventScroll: true });
    };
  }, [abierta]);

  if (!montada) return null;
  const cerrar = saliendo ? undefined : alCerrar;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        onClick={cerrar}
        className={`absolute inset-0 bg-tinta/48 ${saliendo ? "animate-desaparecer" : "animate-aparecer"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={[
          "relative flex w-full flex-col bg-fondo shadow-hoja outline-none",
          pantallaCompleta ? "h-dvh" : "max-h-[90dvh] rounded-t-lg",
          "md:h-auto md:max-h-[85dvh] md:rounded-lg md:shadow-flotante",
          ancho === "amplio" ? "md:max-w-[1040px]" : "md:max-w-lg",
          saliendo ? "animate-bajar md:animate-desaparecer" : "animate-subir md:animate-asomar",
        ].join(" ")}
      >
        <header
          className={
            tituloVisible
              ? "flex items-center gap-3 border-b border-linea py-2 pl-4 pr-2 md:pl-6"
              : "absolute right-2 top-2 z-10"
          }
        >
          <div className={tituloVisible ? "min-w-0 flex-1" : "sr-only"}>
            <h2 id={idTitulo} className="text-xl font-semibold leading-[26px] text-tinta">
              {titulo}
            </h2>
            {descripcion && <div className="mt-0.5 text-sm text-tinta-suave">{descripcion}</div>}
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full
                       bg-superficie text-tinta transition-colors duration-150 hover:bg-linea"
          >
            <IconoCerrar tamano={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">{children}</div>

        {pie && (
          <footer className="border-t border-linea bg-fondo px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6">
            {pie}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Mantiene el foco dentro de `nodo` al tabular (también lo usa VisorImagen). */
export function atraparTabulador(evento: KeyboardEvent, nodo: HTMLElement) {
  const enfocables = Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
    (elemento) => elemento.getClientRects().length > 0
  );
  if (enfocables.length === 0) {
    evento.preventDefault();
    nodo.focus();
    return;
  }

  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  const activo = document.activeElement;
  const fuera = activo === nodo || !nodo.contains(activo);

  if (evento.shiftKey && (activo === primero || fuera)) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && (activo === ultimo || fuera)) {
    evento.preventDefault();
    primero.focus();
  }
}
