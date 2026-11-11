"use client";

import { useSyncExternalStore } from "react";
import { CopiarDato } from "@/components/pedido/CopiarDato";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { pesos } from "@/lib/format";
import type { ConfiguracionPublica, Pedido } from "@/lib/types";
import { enlaceWhatsApp } from "@/lib/whatsapp";

const sinSuscripcion = () => () => {};
const origenAbierto = () => window.location.origin;
const sinOrigen = () => "";

type Props = {
  pedido: Pick<Pedido, "id" | "numeroPedido" | "total" | "clienteNombre">;
  pago: ConfiguracionPublica["pago"];
  envioInfo: string;
  whatsappNegocio: string;
};

/** Datos de pago arriba y un toque para mandar el comprobante con el mensaje ya escrito. */
export function TarjetaPago({ pedido, pago, envioInfo, whatsappNegocio }: Props) {
  // El enlace usa el dominio que la clienta tiene abierto: la variable del sitio puede apuntar a uno viejo.
  const origen = useSyncExternalStore(sinSuscripcion, origenAbierto, sinOrigen);
  const total = pesos(pedido.total);
  const enlace = origen ? ` ${origen}/pedido/${encodeURIComponent(pedido.id)}` : "";
  const mensaje =
    `Hola, soy ${pedido.clienteNombre.trim()}. Ya pagué mi pedido ${pedido.numeroPedido} por ${total}. ` +
    `Te envío el comprobante.${enlace}`;

  return (
    <section aria-labelledby="titulo-pago" className="rounded-md border border-linea p-4 sm:p-6">
      <h2 id="titulo-pago" className="text-xl font-semibold leading-[26px] text-tinta">
        Cómo pagar
      </h2>

      {pago.numero ? (
        <>
          <p className="mt-1 text-base leading-6 text-tinta">
            {pago.metodo ? `Transfiere ${total} por ${pago.metodo}` : `Transfiere ${total} a esta cuenta`}
          </p>
          <dl className="mt-4 divide-y divide-linea rounded-md bg-superficie">
            <Dato etiqueta={pago.metodo ?? "Cuenta"} valor={pago.numero} copiar={pago.numero} />
            <Dato etiqueta="Valor" valor={total} copiar={String(pedido.total)} texto="Copiar valor" />
          </dl>
          {pago.titular && <p className="mt-3 text-[15px] leading-5 text-tinta">Titular: {pago.titular}</p>}
        </>
      ) : (
        <p className="mt-1 text-base leading-6 text-tinta">Te enviamos los datos de pago por WhatsApp</p>
      )}

      <p className="mt-3 text-[13px] leading-[18px] text-tinta-suave">Envío: {envioInfo}</p>

      <a
        href={enlaceWhatsApp(mensaje, whatsappNegocio)}
        target="_blank"
        rel="noopener noreferrer"
        className={estilosBoton({ tamano: "grande", ancho: true, className: "mt-5" })}
      >
        <IconoWhatsApp tamano={22} />
        Ya pagué: enviar comprobante
      </a>
    </section>
  );
}

function Dato(p: { etiqueta: string; valor: string; copiar: string; texto?: string }) {
  return (
    <div className="px-3.5 py-3">
      <dt className="text-[13px] leading-[18px] text-tinta-suave">{p.etiqueta}</dt>
      <dd className="mt-0.5 flex items-center justify-between gap-3">
        <span className="min-w-0 select-all break-all text-lg font-semibold leading-6 tabular-nums text-tinta">
          {p.valor}
        </span>
        <CopiarDato valor={p.copiar} texto={p.texto} />
      </dd>
    </div>
  );
}
