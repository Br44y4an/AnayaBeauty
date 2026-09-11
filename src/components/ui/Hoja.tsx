"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconoCerrar } from "@/components/ui/Iconos";

/**
 * Hoja inferior (bottom sheet).
 *
 * POR QUÉ UNA HOJA Y NO OTRA PÁGINA
 *
 * Entrar al detalle de un producto para elegir un tono y volver son dos
 * navegaciones, dos cargas y perder el sitio en el catálogo — carísimo en
 * mitad de un live. La hoja aparece encima, se resuelve y se va: la
 * clienta nunca pierde dónde estaba.
 *
 * Sube desde abajo porque ahí está el pulgar. En pantallas grandes se
 * centra como diálogo, que es lo que se espera con ratón.
 *
 * Accesibilidad: atrapa el tabulador (si no, se tabula al catálogo de
 * detrás, que no se ve), cierra con Escape, devuelve el foco a donde
 * estaba al cerrarse, y bloquea el scroll del fondo.
 */
export function Hoja({
  titulo,
  descripcion,
  alCerrar,
  children,
  pie,
}: {
  titulo: string;
  descripcion?: ReactNode;
  alCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focoPrevio.current = document.activeElement as HTMLElement | null;

    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El primer foco va al panel, no al primer botón: si cayera en el
    // primer tono, el lector de pantalla empezaría a leer la paleta sin
    // haber dicho de qué producto es.
    panel.current?.focus();

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        alCerrar();
        return;
      }

      if (e.key !== "Tab" || !panel.current) return;

      const enfocables = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (enfocables.length === 0) return;

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const activo = document.activeElement;

      if (e.shiftKey && (activo === primero || activo === panel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPulsar, true);

    return () => {
      document.removeEventListener("keydown", alPulsar, true);
      document.body.style.overflow = desbordeOriginal;
      focoPrevio.current?.focus?.();
    };
  }, [alCerrar]);

  return (
    <div
      onClick={alCerrar}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-carbon/55
                 animate-[aparecer_0.18s_ease] sm:items-center sm:p-4"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-tarjeta bg-petalo
                   shadow-hoja outline-none animate-[subir-hoja_0.24s_ease-out]
                   sm:max-h-[85vh] sm:rounded-tarjeta"
      >
        {/* Asa: le dice a la clienta que esto es una hoja, no una página */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-lila-suave" />
        </div>

        <header className="flex items-start gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight text-carbon">{titulo}</h2>
            {descripcion && (
              <div className="pt-0.5 text-sm text-carbon-suave">{descripcion}</div>
            )}
          </div>

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center
                       rounded-full bg-rosa-nube text-carbon transition
                       hover:bg-lila-suave/60"
          >
            <IconoCerrar className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {children}
        </div>

        {pie && (
          <footer className="margen-seguro border-t border-rosa-nube bg-petalo px-5 py-4">
            {pie}
          </footer>
        )}
      </div>
    </div>
  );
}
