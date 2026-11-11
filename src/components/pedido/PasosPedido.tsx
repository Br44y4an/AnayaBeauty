import { IconoCheck } from "@/components/ui/Iconos";
import { pesos } from "@/lib/format";
import type { EstadoPedido } from "@/lib/types";

type Paso = { titulo: string; detalle: string; hecho: string };

/** Pasos ya cumplidos según el estado: quien vuelve a su pedido ve en qué va, no otra vez «transfiere». */
const CUMPLIDOS: Record<Exclude<EstadoPedido, "cancelado">, number> = { nuevo: 0, pagado: 2, enviado: 3 };

type Props = { estado: Exclude<EstadoPedido, "cancelado">; total: number; conDatosDePago: boolean };

export function PasosPedido({ estado, total, conDatosDePago }: Props) {
  const cumplidos = CUMPLIDOS[estado];
  const pasos: Paso[] = [
    {
      titulo: `Transfiere ${pesos(total)}`,
      detalle: conDatosDePago ? "Con los datos de «Cómo pagar»." : "Te escribimos por WhatsApp con los datos de pago.",
      hecho: "Recibimos tu pago",
    },
    {
      titulo: "Envía el comprobante",
      detalle: "Por WhatsApp, con el botón «Ya pagué: enviar comprobante».",
      hecho: "Comprobante recibido",
    },
    {
      titulo: "Te avisamos al despachar",
      detalle: "Te escribimos por WhatsApp cuando salga tu paquete.",
      hecho: "Tu pedido ya salió",
    },
  ];
  const titulo = estado === "nuevo" ? "Qué sigue" : "Cómo va tu pedido";

  return (
    <section aria-labelledby="titulo-pasos">
      <h2 id="titulo-pasos" className="text-xl font-semibold leading-[26px] text-tinta">
        {titulo}
      </h2>
      <ol className="mt-4 space-y-4">
        {pasos.map((paso, i) => {
          const hecho = i < cumplidos;
          return (
            <li key={paso.titulo} className="flex gap-3">
              {hecho ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ahorro-fondo text-ahorro">
                  <IconoCheck tamano={18} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-borde text-sm
                             font-semibold tabular-nums text-tinta"
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 pt-0.5">
                <p className="text-base font-semibold leading-6 text-tinta">
                  {hecho && <span className="sr-only">Hecho: </span>}
                  {hecho ? paso.hecho : paso.titulo}
                </p>
                {!hecho && <p className="text-[15px] leading-5 text-tinta-suave">{paso.detalle}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
