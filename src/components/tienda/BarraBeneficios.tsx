import { Fragment } from "react";
import { pesos } from "@/lib/format";
import type { ReglaDescuento } from "@/lib/discounts";

const porcentaje = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
// Pegado al texto anterior: si la línea se parte, el punto nunca abre la siguiente.
const SEPARADOR = " · ";

type Beneficio = { lema: string; detalle: string };

function beneficios(reglas: ReglaDescuento[], umbralPorMayor: number): Beneficio[] {
  const descuentos = reglas
    .filter((r) => r.porcentaje > 0 && r.porcentaje <= 100)
    .sort((a, b) => a.montoMinimo - b.montoMinimo)
    .map((r) => ({
      lema: `${porcentaje.format(r.porcentaje)} % menos`,
      detalle: r.montoMinimo > 0 ? `desde ${pesos(r.montoMinimo)}` : "en todo el pedido",
    }));

  return umbralPorMayor > 0
    ? [...descuentos, { lema: "Por mayor", detalle: `desde ${pesos(umbralPorMayor)}` }]
    : descuentos;
}

/** Franja de precios del catálogo, generada de las reglas; sin reglas ni umbral no pinta nada. */
export function BarraBeneficios({ reglas, umbralPorMayor }: { reglas: ReglaDescuento[]; umbralPorMayor: number }) {
  const lista = beneficios(reglas, umbralPorMayor);
  if (lista.length === 0) return null;

  return (
    <section aria-label="Precios y descuentos" className="bg-superficie">
      <p className="mx-auto max-w-[1200px] px-4 py-2 text-center text-[13px] leading-[18px] text-tinta md:px-6 md:text-sm md:leading-5">
        {/* En el celular no cabe en una línea; el precio por cantidad ya lo dice cada tarjeta. */}
        <span className="hidden sm:inline">Más unidades, mejor precio{SEPARADOR}</span>
        {lista.map((b, i) => (
          <Fragment key={`${b.lema} ${b.detalle}`}>
            {i > 0 && SEPARADOR}
            <span className="whitespace-nowrap">
              <strong className="font-semibold">{b.lema}</strong> {b.detalle}
            </span>
          </Fragment>
        ))}
      </p>
    </section>
  );
}
