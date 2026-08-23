"use client";

import { IconoMas, IconoMenos } from "@/components/ui/Iconos";

export function SelectorCantidad({
  valor,
  cantidadMaxima,
  alCambiar,
}: {
  valor: number;
  cantidadMaxima: number;
  alCambiar: (nuevo: number) => void;
}) {
  const boton =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition duration-200 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia disabled:opacity-30 " +
    "disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        disabled={valor <= 1}
        onClick={() => alCambiar(valor - 1)}
        className={`${boton} border-2 border-fucsia-suave text-fucsia`}
      >
        <IconoMenos />
      </button>

      <span
        aria-label="Cantidad"
        aria-live="polite"
        className="min-w-[3rem] text-center font-display text-3xl text-carbon"
      >
        {valor}
      </span>

      <button
        type="button"
        aria-label="Aumentar cantidad"
        disabled={valor >= cantidadMaxima}
        onClick={() => alCambiar(valor + 1)}
        className={`${boton} bg-fucsia text-petalo`}
      >
        <IconoMas />
      </button>
    </div>
  );
}
