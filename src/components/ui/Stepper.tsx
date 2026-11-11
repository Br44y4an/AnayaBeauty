import type { Ref } from "react";
import { IconoMas, IconoMenos } from "@/components/ui/Iconos";

type Props = {
  valor: number;
  min?: number;
  max: number;
  onCambiar: (n: number) => void;
  etiqueta: string;
  tamano?: "compacto" | "normal";
  deshabilitado?: boolean;
  className?: string;
  /** El «+»: quien cambia un botón por este stepper le pasa el foco aquí. */
  refMas?: Ref<HTMLButtonElement>;
};

const BOTON =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent " +
  "text-tinta transition-colors duration-150 not-disabled:hover:bg-superficie not-disabled:active:bg-superficie " +
  "disabled:cursor-not-allowed disabled:text-tinta-suave";

// En las listas de variantes casi todo está en 0: un fondo gris en cada «−» las llenaba de cuadros.
const INACTIVO = { normal: "disabled:bg-inactivo", compacto: "disabled:border-linea" } as const;

/** − cantidad +, con botones de 44 px. `etiqueta` nombra la variante: «Agregar uno de Tono 3». */
export function Stepper({
  valor,
  min = 0,
  max,
  onCambiar,
  etiqueta,
  tamano = "normal",
  deshabilitado = false,
  className = "",
  refMas,
}: Props) {
  const puedeQuitar = !deshabilitado && valor > min;
  const puedeAgregar = !deshabilitado && valor < max;
  const boton = `${BOTON} ${INACTIVO[tamano]}`;

  return (
    <div
      role="group"
      aria-label={`Cantidad de ${etiqueta}`}
      className={`inline-flex items-center rounded-md border border-borde bg-fondo ${className}`}
    >
      <button
        type="button"
        aria-label={`Quitar uno de ${etiqueta}`}
        disabled={!puedeQuitar}
        onClick={() => onCambiar(Math.max(min, valor - 1))}
        className={boton}
      >
        <IconoMenos tamano={20} />
      </button>
      <output
        aria-live="polite"
        className={`flex-1 text-center font-semibold tabular-nums text-tinta ${
          tamano === "compacto" ? "min-w-8 text-[15px]" : "min-w-10 text-base"
        }`}
      >
        {valor}
      </output>
      <button
        ref={refMas}
        type="button"
        aria-label={`Agregar uno de ${etiqueta}`}
        disabled={!puedeAgregar}
        onClick={() => onCambiar(Math.min(max, valor + 1))}
        className={boton}
      >
        <IconoMas tamano={20} />
      </button>
    </div>
  );
}
