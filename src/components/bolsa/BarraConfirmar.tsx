import { Boton } from "@/components/ui/Boton";
import { pesos } from "@/lib/format";

type Props = {
  total: number;
  /** Nombre, WhatsApp y ciudad escritos. */
  completo: boolean;
  enviando: boolean;
  alCompletar: () => void;
};

// Fija abajo en el celular y en la columna del resumen en escritorio. El botón dice lo que falta:
// «Completar mis datos» lleva al primer campo vacío; con todo escrito envía el formulario de afuera.
export function BarraConfirmar({ total, completo, enviando, alCompletar }: Props) {
  return (
    <div
      data-pie-fijo
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-fondo px-4 pt-3
                 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:z-auto lg:border-0 lg:p-0 lg:pt-6"
    >
      <div className="mx-auto flex max-w-xl items-center gap-4">
        {!completo && (
          <div className="shrink-0">
            <p className="text-[13px] leading-[18px] text-tinta-suave">Total productos</p>
            <p className="text-xl font-bold leading-[26px] tabular-nums text-tinta">{pesos(total)}</p>
          </div>
        )}
        {completo ? (
          <Boton type="submit" form="form-pedido" tamano="grande" ancho cargando={enviando}>
            Confirmar pedido · {pesos(total)}
          </Boton>
        ) : (
          <Boton type="button" tamano="grande" className="flex-1" onClick={alCompletar}>
            Completar mis datos
          </Boton>
        )}
      </div>
    </div>
  );
}
