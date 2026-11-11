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
};

const BOTON =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta " +
  "transition-colors duration-150 hover:bg-superficie active:bg-superficie " +
  "disabled:cursor-not-allowed disabled:bg-inactivo disabled:text-tinta-suave";

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
}: Props) {
  const puedeQuitar = !deshabilitado && valor > min;
  const puedeAgregar = !deshabilitado && valor < max;

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
        className={BOTON}
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
        type="button"
        aria-label={`Agregar uno de ${etiqueta}`}
        disabled={!puedeAgregar}
        onClick={() => onCambiar(Math.min(max, valor + 1))}
        className={BOTON}
      >
        <IconoMas tamano={20} />
      </button>
    </div>
  );
}
