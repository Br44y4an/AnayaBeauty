import { pesos } from "@/lib/format";
import type { Escalon } from "@/lib/pricing";

type Props = {
  escalones: Escalon[];
  /** Bolsa + selección: el escalón vigente se calcula con todas las variantes juntas. */
  unidadesTotales: number;
  /** El escalón que viene, si ya eligió algo y se puede alcanzar. */
  siguiente?: { faltan: number; precioUnitario: number } | null;
  nota?: string | null;
};

const etiqueta = (min: number) => (min === 1 ? "1 u" : `${min}+`);
const etiquetaLeida = (min: number) => (min === 1 ? "1 unidad:" : `${min} o más unidades:`);

/** El único lugar de la ficha con la oferta por cantidad: precio vigente grande y los escalones al lado. */
export function PreciosPorCantidad({ escalones, unidadesTotales, siguiente = null, nota }: Props) {
  const ordenados = [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);
  if (ordenados.length === 0) return null;

  const referencia = Math.max(1, unidadesTotales);
  const vigente = ordenados.reduce((rige, e) => (e.minCantidad <= referencia ? e : rige), ordenados[0]);

  return (
    <div>
      <p data-testid="precio-vigente" className="text-2xl font-bold leading-[30px] tabular-nums text-tinta">
        {pesos(vigente.precioUnitario)} <span className="text-base font-normal text-tinta-suave">c/u</span>
      </p>

      {ordenados.length > 1 && (
        <ul
          aria-label="Precio por cantidad"
          className="mt-3 grid auto-cols-fr grid-flow-col divide-x divide-linea overflow-hidden rounded-md border border-linea"
        >
          {ordenados.map((e) => {
            const actual = e === vigente;
            return (
              <li
                key={e.minCantidad}
                aria-current={actual || undefined}
                className={`px-3 py-2 ${actual ? "bg-superficie shadow-[inset_0_-2px_0_var(--color-tinta)]" : ""}`}
              >
                <span aria-hidden="true" className="block text-[13px] leading-[18px] text-tinta-suave">
                  {etiqueta(e.minCantidad)}
                </span>
                <span className="sr-only">{etiquetaLeida(e.minCantidad)}</span>
                <span className="block text-[15px] font-semibold leading-5 tabular-nums text-tinta">
                  {pesos(e.precioUnitario)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {siguiente && unidadesTotales > 0 && (
        <p className="mt-2 text-sm font-medium leading-5 text-ahorro tabular-nums">
          {`Con ${siguiente.faltan} más pagas ${pesos(siguiente.precioUnitario)} c/u.`}
        </p>
      )}
      {nota && <p className="mt-2 text-[13px] leading-[18px] text-tinta-suave">{nota}</p>}
    </div>
  );
}
