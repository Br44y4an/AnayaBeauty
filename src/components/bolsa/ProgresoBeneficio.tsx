import { IconoCheck } from "@/components/ui/Iconos";
import type { ReglaDescuento, Totales } from "@/lib/discounts";
import { pesos } from "@/lib/format";

type Meta = { faltan: number; avance: number; texto: string };

const porciento = (n: number) => `${n} %`;

/** El beneficio más cercano que aún no tiene: el % se mide sobre el subtotal ya con precio por mayor. */
function siguienteMeta(t: Totales, reglas: ReglaDescuento[], umbralPorMayor: number): Meta | null {
  const metas = reglas
    .filter((r) => r.porcentaje > t.porcentaje && r.porcentaje <= 100 && r.montoMinimo > t.subtotalBase)
    .map((r) => ({ monto: r.montoMinimo, base: t.subtotalBase, texto: `el ${porciento(r.porcentaje)} de descuento` }));
  if (!t.porMayor && umbralPorMayor > t.subtotalNormal) {
    metas.push({ monto: umbralPorMayor, base: t.subtotalNormal, texto: "el precio por mayor" });
  }

  const [cercana] = metas.sort((a, b) => a.monto - a.base - (b.monto - b.base));
  return cercana
    ? { faltan: cercana.monto - cercana.base, avance: cercana.base / cercana.monto, texto: cercana.texto }
    : null;
}

function logrado(t: Totales): string | null {
  if (t.porMayor && t.porcentaje > 0) return `Precio por mayor aplicado y ${porciento(t.porcentaje)} de descuento`;
  if (t.porMayor) return "Precio por mayor aplicado";
  if (t.porcentaje > 0) return `Tienes ${porciento(t.porcentaje)} de descuento`;
  return null;
}

/** Lo que ya ganó y cuánto le falta para lo siguiente. Sin reglas ni umbral no pinta nada. */
export function ProgresoBeneficio(p: { totales: Totales; reglas: ReglaDescuento[]; umbralPorMayor: number }) {
  const meta = siguienteMeta(p.totales, p.reglas, p.umbralPorMayor);
  const ya = logrado(p.totales);
  if (!meta && !ya) return null;

  return (
    <section aria-label="Beneficios de tu pedido" className="space-y-2">
      {ya && (
        <p className="flex items-center gap-1.5 text-[15px] font-semibold leading-5 text-ahorro">
          <IconoCheck tamano={20} className="shrink-0" />
          {ya}
        </p>
      )}
      {meta && (
        <>
          <p className="text-[15px] leading-5 text-tinta">
            Te faltan {pesos(meta.faltan)} para {meta.texto}
          </p>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-linea">
            <div className="h-full rounded-full bg-ahorro" style={{ width: `${Math.round(meta.avance * 100)}%` }} />
          </div>
        </>
      )}
    </section>
  );
}
