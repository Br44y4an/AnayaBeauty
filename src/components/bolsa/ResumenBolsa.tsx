import type { Totales } from "@/lib/discounts";
import { pesos } from "@/lib/format";

/** Total honesto: los precios ya traen el escalón y el precio por mayor; el envío se coordina aparte. */
export function ResumenBolsa({ totales, envioInfo }: { totales: Totales; envioInfo: string }) {
  return (
    <section aria-label="Resumen de tu bolsa">
      <dl className="space-y-2 text-[15px] leading-5">
        {totales.porcentaje > 0 && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-tinta-suave">Subtotal</dt>
              <dd className="tabular-nums text-tinta">{pesos(totales.subtotalBase)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-ahorro">
              <dt>Descuento ({totales.porcentaje}&nbsp;%)</dt>
              <dd className="tabular-nums">−{pesos(totales.descuento)}</dd>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t border-linea pt-3">
          <dt className="font-semibold text-tinta">Total productos</dt>
          <dd className="text-2xl font-bold leading-[30px] tabular-nums text-tinta">{pesos(totales.total)}</dd>
        </div>
        <div className="text-[13px] leading-[18px] text-tinta-suave">
          <dt className="font-semibold">Envío</dt>
          <dd>{envioInfo}</dd>
        </div>
      </dl>
    </section>
  );
}
