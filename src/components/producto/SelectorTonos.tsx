"use client";

import type { Tono } from "@/lib/types";

/**
 * Círculos de color para elegir tono.
 *
 * El color nunca es el único indicador: el tono elegido se nombra en texto
 * debajo, y cada círculo lleva su nombre accesible. Así funciona también
 * para quien no distingue colores.
 */
export function SelectorTonos({
  tonos,
  elegido,
  alElegir,
  compacto = false,
}: {
  tonos: Tono[];
  elegido: Tono | null;
  alElegir: (tono: Tono) => void;
  compacto?: boolean;
}) {
  if (tonos.length === 0) return null;

  const tamano = compacto ? "h-7 w-7" : "h-9 w-9";

  return (
    <div className={compacto ? "space-y-1" : "space-y-2"}>
      <ul
        role="radiogroup"
        aria-label="Tonos disponibles"
        className="flex flex-wrap items-center gap-2"
      >
        {tonos.map((t) => {
          const activo = elegido?.id === t.id;

          return (
            <li key={t.id}>
              <button
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={t.nombre}
                title={t.nombre}
                onClick={() => alElegir(t)}
                style={{ backgroundColor: t.colorHex }}
                className={`${tamano} cursor-pointer rounded-full transition duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia
                  focus-visible:ring-offset-2
                  ${
                    activo
                      ? "ring-2 ring-carbon ring-offset-2 ring-offset-petalo"
                      : "ring-1 ring-black/10 hover:scale-110"
                  }`}
              />
            </li>
          );
        })}
      </ul>

      <p
        aria-live="polite"
        className={`${compacto ? "text-[11px]" : "text-sm"} ${
          elegido ? "font-semibold text-carbon" : "text-carbon-suave"
        }`}
      >
        {elegido ? `Tono: ${elegido.nombre}` : "Elige tu tono"}
      </p>
    </div>
  );
}
