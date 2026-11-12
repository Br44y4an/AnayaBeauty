import { Stepper } from "@/components/ui/Stepper";
import { IconoEliminar } from "@/components/ui/Iconos";
import { AvisoCambios } from "@/components/bolsa/AvisoCambios";
import { necesitaBorde } from "@/lib/tonos";

type Props = {
  /** Nombre de la variante; null en un producto sin variantes. */
  nombre: string | null;
  /** Color real del tono (colorDeMuestra); null si nunca se le eligió uno. */
  colorHex: string | null;
  cantidad: number;
  max: number;
  /** «Brillo labial, Tono 3»: nombra la línea para el lector de pantalla. */
  etiqueta: string;
  aviso: string | null;
  alCambiar: (n: number) => void;
  alQuitar: () => void;
};

/** Una fila por variante: [muestra] nombre, cantidad y papelera. Bajar a 0 la quita (con «Deshacer»). */
export function LineaVariante({ nombre, colorHex, cantidad, max, etiqueta, aviso, alCambiar, alQuitar }: Props) {
  const pedible = cantidad > 0;

  return (
    <li className="py-1">
      <div className="flex min-h-14 items-center gap-3">
        {colorHex && (
          <span
            aria-hidden="true"
            className={`size-5 shrink-0 rounded-full ${necesitaBorde(colorHex) ? "ring-1 ring-borde ring-inset" : ""}`}
            style={{ backgroundColor: colorHex }}
          />
        )}
        <span
          className={`min-w-0 flex-1 text-[15px] leading-5 ${nombre && pedible ? "text-tinta" : "text-tinta-suave"}`}
        >
          {nombre ?? (pedible ? "Cantidad" : "")}
        </span>
        {pedible && (
          <Stepper valor={cantidad} min={0} max={max} onCambiar={alCambiar} etiqueta={etiqueta} tamano="compacto" />
        )}
        <button
          type="button"
          onClick={alQuitar}
          aria-label={`Quitar ${etiqueta} de la bolsa`}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta-suave
                     transition-colors duration-150 hover:bg-superficie hover:text-tinta"
        >
          <IconoEliminar tamano={20} />
        </button>
      </div>
      {aviso && <AvisoCambios texto={aviso} />}
    </li>
  );
}
