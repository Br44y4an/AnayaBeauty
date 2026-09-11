import { pesos } from "@/lib/format";
import type { ReglaDescuento } from "@/lib/discounts";

/**
 * Las reglas del juego, a la vista desde el primer segundo.
 *
 * Los descuentos existían pero solo se descubrían al llegar al carrito,
 * cuando ya estaba todo elegido. Decirlos arriba cambia lo que la clienta
 * mete en la bolsa: saber que a los $200.000 baja todo el pedido es
 * información útil ANTES de decidir, no después.
 *
 * También es lo honesto: nada de "sorpresas" al final.
 */
export function CintaBeneficios({
  reglas,
  umbralPorMayor,
}: {
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
}) {
  const mejorRegla = [...reglas]
    .filter((r) => r.porcentaje > 0)
    .sort((a, b) => a.montoMinimo - b.montoMinimo)[0];

  const puntos = [
    {
      icono: "🏷️",
      titulo: "Mientras más llevas, menos cuesta",
      texto: "El precio por unidad baja solo al sumar cantidad.",
    },
    umbralPorMayor > 0 && {
      icono: "🎉",
      titulo: `Desde ${pesos(umbralPorMayor)}, precio por mayor`,
      texto: "Todo tu pedido pasa al mejor precio de cada producto.",
    },
    mejorRegla && {
      icono: "✨",
      titulo: `Desde ${pesos(mejorRegla.montoMinimo)}, ${mejorRegla.porcentaje}% extra`,
      texto: "Se descuenta solo al confirmar, sin cupones ni códigos.",
    },
  ].filter(Boolean) as { icono: string; titulo: string; texto: string }[];

  if (puntos.length === 0) return null;

  return (
    <section
      aria-label="Cómo ahorras en tu pedido"
      className="grid gap-2 pb-1 pt-4 sm:grid-cols-3"
    >
      {puntos.map((p) => (
        <div
          key={p.titulo}
          className="flex items-start gap-3 rounded-tarjeta bg-petalo px-4 py-3 shadow-petalo"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            {p.icono}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-snug text-carbon">{p.titulo}</p>
            <p className="text-sm leading-snug text-carbon-suave">{p.texto}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
