import { Giro } from "@/components/ui/Giro";

/** Cubre la bolsa mientras se confirma y hasta que abre el pedido: sin parpadeo de «bolsa vacía». */
export function PantallaConfirmando() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-[65] flex animate-aparecer flex-col items-center justify-center gap-3 bg-fondo px-6
                 text-center"
    >
      <Giro className="size-8 text-tinta" />
      <p className="mt-2 text-xl font-semibold leading-[26px] text-tinta">Confirmando tu pedido…</p>
      <p className="text-[15px] leading-5 text-tinta-suave">No cierres esta página.</p>
    </div>
  );
}
