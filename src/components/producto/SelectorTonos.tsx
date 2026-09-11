"use client";

import { useMemo, useState } from "react";
import { agruparTonos, filtrarTonos, necesitaBorde } from "@/lib/tonos";
import { IconoBuscar, IconoCheck, IconoCerrar } from "@/components/ui/Iconos";
import type { Tono } from "@/lib/types";

/**
 * Selector de tono.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 *
 * Antes era una fila de círculos de 28px, sin nombre, con el nombre del
 * elegido en una línea aparte. Con paletas de 30 o 40 tonos eso era
 * imposible de usar: no se distinguía un palo rosa de un nude a ese
 * tamaño, no se podía buscar, y si la clienta quería "el Rubí" tenía que
 * ir pasando el dedo uno por uno leyendo el aria-label.
 *
 * Ahora cada tono es un botón de 44px con SU NOMBRE DEBAJO. Cuesta más
 * espacio, y por eso vive en la hoja de selección y no en la tarjeta del
 * catálogo. Cuando la paleta es larga se agrupa por familia de color
 * (Rojos, Nudes, Rosados…) y aparece un buscador: nadie recuerda un
 * código hexadecimal, pero sí que "era un rojo".
 *
 * El color NUNCA es el único indicador: siempre hay nombre en texto y la
 * marca de elegido es una palomita, no solo un anillo de color.
 */
export function SelectorTonos({
  tonos,
  elegido,
  alElegir,
  idEtiqueta,
}: {
  tonos: Tono[];
  elegido: Tono | null;
  alElegir: (tono: Tono) => void;
  idEtiqueta?: string;
}) {
  const [busqueda, setBusqueda] = useState("");

  const conBuscador = tonos.length > 12;

  const grupos = useMemo(() => {
    const visibles = conBuscador ? filtrarTonos(tonos, busqueda) : tonos;
    return agruparTonos(visibles);
  }, [tonos, busqueda, conBuscador]);

  const visibles = grupos.reduce((n, g) => n + g.tonos.length, 0);

  if (tonos.length === 0) return null;

  return (
    <div className="space-y-3">
      {conBuscador && (
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lila-texto">
            <IconoBuscar className="h-5 w-5" />
          </span>

          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar entre ${tonos.length} tonos…`}
            aria-label="Buscar un tono por su nombre"
            className="min-h-[48px] w-full rounded-pastilla border-2 border-lila-suave
                       bg-rosa-nube py-2 pl-12 pr-12 text-base text-carbon outline-none
                       transition placeholder:text-carbon-suave/70 focus:border-fucsia"
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Borrar la búsqueda"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2
                         cursor-pointer items-center justify-center rounded-full
                         text-carbon-suave transition hover:text-fucsia-texto"
            >
              <IconoCerrar className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {visibles === 0 && (
        <p className="rounded-suave bg-rosa-nube px-4 py-6 text-center text-carbon-suave">
          No hay ningún tono que se llame así. Prueba con otra palabra o
          bórrala para verlos todos.
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Tonos disponibles"
        aria-labelledby={idEtiqueta}
        className="space-y-4"
      >
        {grupos.map((grupo) => (
          <div key={grupo.clave} className="space-y-2">
            {grupo.etiqueta && (
              <p className="text-sm font-bold uppercase tracking-wide text-carbon-suave">
                {grupo.etiqueta}
              </p>
            )}

            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {grupo.tonos.map((t) => (
                <li key={t.id}>
                  <BotonTono
                    tono={t}
                    activo={elegido?.id === t.id}
                    alElegir={() => alElegir(t)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Confirmación en texto de lo elegido, anunciada al lector de
          pantalla: el anillo alrededor del círculo no se "oye". */}
      <p aria-live="polite" className="min-h-[1.5rem] text-base font-semibold text-carbon">
        {elegido ? `Elegiste: ${elegido.nombre}` : ""}
      </p>
    </div>
  );
}

function BotonTono({
  tono,
  activo,
  alElegir,
}: {
  tono: Tono;
  activo: boolean;
  alElegir: () => void;
}) {
  // Un tono blanco o crema sobre fondo blanco desaparece: sin borde la
  // clienta ve un hueco donde debería haber una opción.
  const borde = necesitaBorde(tono.colorHex) ? "ring-1 ring-carbon/25" : "ring-1 ring-black/10";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={alElegir}
      className={`flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-suave
        px-1 py-2.5 text-center transition duration-200
        ${activo ? "bg-fucsia/10 ring-2 ring-fucsia" : "hover:bg-rosa-nube"}`}
    >
      <span
        style={{ backgroundColor: tono.colorHex }}
        aria-hidden="true"
        className={`flex h-11 w-11 items-center justify-center rounded-full ${borde}`}
      >
        {activo && (
          <IconoCheck className="h-6 w-6 text-petalo drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
        )}
      </span>

      <span
        className={`line-clamp-2 text-xs leading-tight ${
          activo ? "font-bold text-fucsia-texto" : "text-carbon"
        }`}
      >
        {tono.nombre}
      </span>
    </button>
  );
}
