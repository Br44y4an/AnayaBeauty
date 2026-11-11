"use client";

import { useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { CampoArea } from "@/components/admin/CamposPanel";
import type { Resultado } from "@/lib/admin/resultado";
import { guardarAjustes } from "./actions";

const SIN_CONEXION = "No se pudo conectar para guardar. Revisa tu internet e intenta otra vez.";
const SECCION = "space-y-5 border-t border-linea pt-6 first:border-t-0 first:pt-0";
const TITULO = "text-xl font-semibold leading-[26px] text-tinta";

export type ValoresAjustes = {
  pago_metodo: string;
  pago_numero: string;
  pago_titular: string;
  whatsapp_negocio: string;
  mensaje_exito: string;
  envio_info: string;
};

/** Lo que ve la clienta al pagar, al escribir por WhatsApp y al confirmar su pedido. */
export function FormularioAjustes({ valores, envioPorDefecto }: { valores: ValoresAjustes; envioPorDefecto: string }) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const errores = (resultado && !resultado.ok && resultado.campos) || {};

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setResultado(null);
    iniciar(async () => {
      const respuesta = (await guardarAjustes(datos).catch(() => null)) ?? { ok: false, error: SIN_CONEXION };
      flushSync(() => setResultado(respuesta));
      if (!respuesta.ok) formulario.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <section aria-labelledby="pago-titulo" className={SECCION}>
        <div>
          <h2 id="pago-titulo" className={TITULO}>
            Datos de pago
          </h2>
          <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
            Salen en la página del pedido, con botones para copiarlos. Si los dejas vacíos, la clienta lee «Te
            enviamos los datos de pago por WhatsApp».
          </p>
        </div>
        <Campo
          id="pago_metodo"
          name="pago_metodo"
          etiqueta="Método de pago"
          ayuda="Por ejemplo Nequi, Daviplata o Bancolombia."
          defaultValue={valores.pago_metodo}
          error={errores.pago_metodo}
          maxLength={60}
        />
        <Campo
          id="pago_numero"
          name="pago_numero"
          etiqueta="Número o cuenta"
          defaultValue={valores.pago_numero}
          error={errores.pago_numero}
          maxLength={60}
          autoComplete="off"
        />
        <Campo
          id="pago_titular"
          name="pago_titular"
          etiqueta="A nombre de"
          defaultValue={valores.pago_titular}
          error={errores.pago_titular}
          maxLength={80}
          autoComplete="off"
        />
      </section>

      <section aria-labelledby="contacto-titulo" className={SECCION}>
        <h2 id="contacto-titulo" className={TITULO}>
          WhatsApp
        </h2>
        <Campo
          id="whatsapp_negocio"
          name="whatsapp_negocio"
          etiqueta="WhatsApp del negocio"
          ayuda="Celular de 10 dígitos, por ejemplo 300 123 4567. A este número te escriben las clientas y te mandan los comprobantes."
          defaultValue={valores.whatsapp_negocio}
          error={errores.whatsapp_negocio}
          inputMode="tel"
          autoComplete="off"
          required
        />
      </section>

      <section aria-labelledby="pedido-titulo" className={SECCION}>
        <h2 id="pedido-titulo" className={TITULO}>
          Pedido y envío
        </h2>
        <CampoArea
          id="envio_info"
          name="envio_info"
          etiqueta="Información de envío"
          ayuda={`Sale en la bolsa y en el pedido, después de «Envío:». Si lo dejas vacío dice: ${envioPorDefecto}`}
          defaultValue={valores.envio_info}
          error={errores.envio_info}
          maxLength={300}
          rows={3}
        />
        <Campo
          id="mensaje_exito"
          name="mensaje_exito"
          etiqueta="Mensaje de agradecimiento"
          ayuda="Sale debajo de «¡Pedido confirmado!». Por ejemplo: Gracias por comprar en Anaya Beauty."
          defaultValue={valores.mensaje_exito}
          error={errores.mensaje_exito}
          maxLength={160}
        />
      </section>

      <div className="space-y-4 border-t border-linea pt-6">
        {resultado && !resultado.ok && <AvisoPanel tono="error">{resultado.error}</AvisoPanel>}
        {resultado?.ok && <AvisoPanel tono="exito">Guardaste los ajustes. La tienda ya los muestra.</AvisoPanel>}
        <Boton type="submit" cargando={pendiente}>
          {pendiente ? "Guardando…" : "Guardar ajustes"}
        </Boton>
      </div>
    </form>
  );
}
