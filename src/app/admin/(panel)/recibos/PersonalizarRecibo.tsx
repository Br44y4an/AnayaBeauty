"use client";

import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { CampoArea, Interruptor } from "@/components/admin/CamposPanel";
import { CIERRE_POR_DEFECTO, LARGO, PREFERENCIAS_POR_DEFECTO, type PreferenciasRecibo } from "@/lib/admin/recibo";
import { SeccionRecibo } from "./SeccionRecibo";

/** Cómo se llama el documento, su número y fecha, la nota al pie y si lleva los datos de pago. */
export function PersonalizarRecibo({
  preferencias,
  numero,
  fecha,
  pago,
  alCambiarPreferencias,
  alRestablecer,
  alCambiarNumero,
  alCambiarFecha,
}: {
  preferencias: PreferenciasRecibo;
  numero: string;
  fecha: string;
  /** «Nequi 322 881 3646», o null si no hay datos de pago en Ajustes. */
  pago: string | null;
  alCambiarPreferencias: (cambios: Partial<PreferenciasRecibo>) => void;
  alRestablecer: () => void;
  alCambiarNumero: (valor: string) => void;
  alCambiarFecha: (valor: string) => void;
}) {
  const porDefecto =
    preferencias.titulo === PREFERENCIAS_POR_DEFECTO.titulo &&
    preferencias.nota === PREFERENCIAS_POR_DEFECTO.nota &&
    preferencias.mostrarPago === PREFERENCIAS_POR_DEFECTO.mostrarPago;

  return (
    <SeccionRecibo
      id="recibo-personalizar"
      titulo="Personalizar"
      ayuda="El título, la nota y los datos de pago se recuerdan en este navegador para el próximo recibo."
      accion={
        !porDefecto && (
          <Boton
            type="button"
            variante="contorno"
            tamano="compacto"
            onClick={() => {
              alRestablecer();
              // El botón desaparece y soltaría el foco: pasa al título, que es lo que cambió.
              document.getElementById("recibo-titulo")?.focus();
            }}
          >
            Restablecer
          </Boton>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="recibo-titulo"
          etiqueta="Título"
          ayuda="Por ejemplo: Cuenta de cobro o Cotización."
          className="sm:col-span-2"
          value={preferencias.titulo}
          onChange={(e) => alCambiarPreferencias({ titulo: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) alCambiarPreferencias({ titulo: PREFERENCIAS_POR_DEFECTO.titulo });
          }}
          maxLength={LARGO.titulo}
          autoComplete="off"
        />
        <Campo
          id="recibo-numero"
          etiqueta="Número"
          value={numero}
          onChange={(e) => alCambiarNumero(e.target.value)}
          maxLength={LARGO.numero}
          autoComplete="off"
        />
        <Campo
          id="recibo-fecha"
          etiqueta="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => alCambiarFecha(e.target.value)}
        />
        <CampoArea
          id="recibo-nota"
          etiqueta="Nota al pie (opcional)"
          ayuda={`Condiciones, garantía o un agradecimiento. Si la dejas vacía, dice: ${CIERRE_POR_DEFECTO.titulo}`}
          className="sm:col-span-2"
          value={preferencias.nota}
          onChange={(e) => alCambiarPreferencias({ nota: e.target.value })}
          maxLength={LARGO.nota}
          rows={3}
        />
        <Interruptor
          id="recibo-pago"
          etiqueta="Mostrar los datos de pago"
          ayuda={pago ?? "No hay datos de pago en Ajustes: el recibo sale sin ellos."}
          className="sm:col-span-2"
          checked={preferencias.mostrarPago}
          disabled={!pago}
          onChange={(e) => alCambiarPreferencias({ mostrarPago: e.target.checked })}
        />
      </div>
    </SeccionRecibo>
  );
}
