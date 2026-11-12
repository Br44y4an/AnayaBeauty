"use client";

import { pesos } from "@/lib/format";
import { SeccionRecibo } from "./SeccionRecibo";

const PRECIO =
  "min-h-11 w-28 rounded-md border border-borde bg-fondo px-2 text-right text-base font-semibold tabular-nums text-tinta";

/** Subtotal de todo, el descuento (editable, y si sale o no en el recibo) y el total que se cobra. */
export function ResumenRecibo({
  subtotal,
  descuento,
  descuentoCalculado,
  mostrarDescuento,
  porMayor,
  ahorroPorMayor,
  total,
  hayCatalogo,
  hayTexto,
  alCambiarDescuento,
  alMostrarDescuento,
}: {
  subtotal: number;
  descuento: number;
  descuentoCalculado: number;
  mostrarDescuento: boolean;
  porMayor: boolean;
  ahorroPorMayor: number;
  total: number;
  hayCatalogo: boolean;
  hayTexto: boolean;
  alCambiarDescuento: (valor: number | null) => void;
  alMostrarDescuento: (valor: boolean) => void;
}) {
  return (
    <SeccionRecibo id="recibo-resumen" titulo="Resumen">
      <dl className="space-y-2 text-[15px] leading-5">
        <div className="flex justify-between gap-4">
          <dt className="text-tinta-suave">Subtotal</dt>
          <dd className="tabular-nums text-tinta">{pesos(subtotal)}</dd>
        </div>
        {porMayor && ahorroPorMayor > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Precio por mayor (ya aplicado)</dt>
            <dd className="tabular-nums text-ahorro">−{pesos(ahorroPorMayor)}</dd>
          </div>
        )}
        {hayCatalogo && (
          <div className="space-y-1 rounded-md bg-superficie p-3">
            <div className="flex items-center justify-between gap-4">
              <dt>
                <label htmlFor="recibo-descuento" className="font-semibold text-tinta">
                  Descuento
                </label>
                {descuento !== descuentoCalculado && (
                  <button
                    type="button"
                    onClick={() => alCambiarDescuento(null)}
                    className="block min-h-11 cursor-pointer text-left text-sm font-semibold text-tinta underline underline-offset-2"
                  >
                    Usar el calculado ({pesos(descuentoCalculado)})
                  </button>
                )}
              </dt>
              <dd>
                <input
                  id="recibo-descuento"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className={PRECIO}
                  value={descuento}
                  onChange={(e) =>
                    alCambiarDescuento(e.target.value === "" ? 0 : Math.max(0, Math.round(Number(e.target.value) || 0)))
                  }
                />
              </dd>
            </div>
            <label className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-sm text-tinta">
              <input
                type="checkbox"
                className="size-5 accent-tinta"
                checked={mostrarDescuento}
                onChange={(e) => alMostrarDescuento(e.target.checked)}
              />
              Mostrar el descuento en el recibo
            </label>
            {!mostrarDescuento && descuento > 0 && (
              <p className="text-[13px] leading-[18px] text-tinta-suave">
                El recibo muestra solo el total, que ya tiene el descuento.
              </p>
            )}
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t border-linea pt-3 text-tinta">
          <dt className="text-base font-semibold">Total</dt>
          <dd className="text-2xl font-bold leading-[30px] tabular-nums">{pesos(total)}</dd>
        </div>
      </dl>
      {hayTexto && hayCatalogo && (
        <p className="mt-2 text-[13px] leading-[18px] text-tinta-suave">
          Los productos en texto se suman después del descuento.
        </p>
      )}
    </SeccionRecibo>
  );
}
