"use client";

import { IconoChevron, IconoEliminar } from "@/components/ui/Iconos";
import type { VarianteEditable } from "@/lib/admin/variantes";

export type FilaEditable = VarianteEditable & { clave: string };

/** El color que traía el formulario viejo: la tienda lo toma como «sin elegir» (`colorDeMuestra`), salvo en un tono que se llame fucsia o rosado. */
export const SIN_COLOR = "#e5308a";

const BOTON_ICONO =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta hover:bg-superficie " +
  "disabled:cursor-not-allowed disabled:text-borde disabled:hover:bg-transparent";

export function FilaVariante({
  fila,
  posicion,
  esPrimera,
  esUltima,
  registrar,
  alCambiar,
  alMover,
  alQuitar,
}: {
  fila: FilaEditable;
  posicion: number;
  esPrimera: boolean;
  esUltima: boolean;
  registrar: (clave: string) => (nodo: HTMLElement | null) => void;
  alCambiar: (cambio: Partial<FilaEditable>) => void;
  alMover: (paso: -1 | 1) => void;
  alQuitar: () => void;
}) {
  const sinColor = fila.colorHex.toLowerCase() === SIN_COLOR;
  const quien = fila.nombre.trim() || `la fila ${posicion}`;

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="w-6 shrink-0 text-right text-[15px] font-semibold tabular-nums text-tinta-suave">
          {posicion}
        </span>
        <label
          className="relative size-11 shrink-0 cursor-pointer rounded-md border border-borde focus-within:outline-2
                     focus-within:outline-offset-2 focus-within:outline-acento"
          style={sinColor ? undefined : { backgroundColor: fila.colorHex }}
        >
          {sinColor && (
            <span
              aria-hidden="true"
              className="absolute inset-0.5 rounded-[5px]
                         bg-[repeating-linear-gradient(135deg,var(--color-superficie)_0_5px,var(--color-linea)_5px_10px)]"
            />
          )}
          <input
            type="color"
            value={fila.colorHex}
            onChange={(e) => alCambiar({ colorHex: e.target.value })}
            aria-label={`Color de ${quien}${sinColor ? ", sin elegir" : ""}`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <input
          ref={registrar(`${fila.clave}:nombre`)}
          value={fila.nombre}
          onChange={(e) => alCambiar({ nombre: e.target.value })}
          aria-label={`Nombre de la fila ${posicion}`}
          autoComplete="off"
          maxLength={60}
          className="min-h-12 min-w-0 flex-1 rounded-md border border-borde bg-fondo px-3.5 text-base text-tinta"
        />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 pl-9">
        <label className="relative flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            role="switch"
            checked={fila.agotado}
            onChange={(e) => alCambiar({ agotado: e.target.checked })}
            aria-label={`Agotado: ${quien}`}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="h-6 w-11 rounded-full bg-borde transition-colors duration-150 ease-entrada peer-checked:bg-tinta
                       peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acento"
          />
          <span
            aria-hidden="true"
            className="absolute left-0.5 size-5 rounded-full bg-fondo transition-transform duration-150 ease-entrada
                       peer-checked:translate-x-5"
          />
          <span className="text-[15px] leading-5 text-tinta">Agotado</span>
        </label>

        <div className="flex">
          <button
            ref={registrar(`${fila.clave}:subir`)}
            type="button"
            disabled={esPrimera}
            onClick={() => alMover(-1)}
            aria-label={`Subir ${quien}`}
            className={BOTON_ICONO}
          >
            <IconoChevron direccion="arriba" tamano={20} />
          </button>
          <button
            ref={registrar(`${fila.clave}:bajar`)}
            type="button"
            disabled={esUltima}
            onClick={() => alMover(1)}
            aria-label={`Bajar ${quien}`}
            className={BOTON_ICONO}
          >
            <IconoChevron direccion="abajo" tamano={20} />
          </button>
          <button type="button" onClick={alQuitar} aria-label={`Quitar ${quien}`} className={BOTON_ICONO}>
            <IconoEliminar tamano={20} />
          </button>
        </div>
      </div>
    </li>
  );
}
