import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuardarPedido } from "@/components/pedido/GuardarPedido";
import { PasosPedido } from "@/components/pedido/PasosPedido";
import { ResumenPedido } from "@/components/pedido/ResumenPedido";
import { TarjetaPago } from "@/components/pedido/TarjetaPago";
import { BotonEnlace, estilosBoton } from "@/components/ui/Boton";
import { IconoCheck, IconoInfo, IconoWhatsApp } from "@/components/ui/Iconos";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { obtenerPedidoPublico } from "@/lib/data/pedido-publico";
import type { Pedido } from "@/lib/types";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Tu pedido",
  // La dirección es la llave del pedido: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Encabezado({ pedido, mensajeExito }: { pedido: Pedido; mensajeExito: string | null }) {
  const cancelado = pedido.estado === "cancelado";
  return (
    <header className="max-w-xl">
      <span
        className={`flex size-12 items-center justify-center rounded-full ${
          cancelado ? "bg-superficie text-tinta-suave" : "bg-ahorro-fondo text-ahorro"
        }`}
      >
        {cancelado ? <IconoInfo tamano={26} /> : <IconoCheck tamano={28} />}
      </span>
      <h1 className="mt-4 text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-tinta">
        {cancelado ? "Pedido cancelado" : "¡Pedido confirmado!"}
      </h1>
      <p className="mt-1 text-[32px] font-bold leading-9 tabular-nums tracking-[-0.01em] text-tinta">
        Pedido {pedido.numeroPedido}
      </p>
      <p className="mt-2 text-[15px] leading-5 text-tinta-suave">Guarda este número para cualquier consulta.</p>
      {mensajeExito && !cancelado && <p className="mt-1 text-[15px] leading-5 text-tinta">{mensajeExito}</p>}
    </header>
  );
}

function AvisoCancelado({ numero, whatsappNegocio }: { numero: string; whatsappNegocio: string }) {
  return (
    <section aria-label="Pedido cancelado" className="rounded-md bg-superficie p-4 sm:p-6">
      <p className="text-base leading-6 text-tinta">
        Este pedido se canceló y no tienes que pagarlo. Si tienes dudas o quieres pedir de nuevo, escríbenos.
      </p>
      <a
        href={enlaceWhatsApp(`Hola, tengo una pregunta sobre mi pedido ${numero}.`, whatsappNegocio)}
        target="_blank"
        rel="noopener noreferrer"
        className={estilosBoton({ variante: "contorno", className: "mt-4 w-full sm:w-auto" })}
      >
        <IconoWhatsApp tamano={20} />
        Escríbenos por WhatsApp
      </a>
    </section>
  );
}

export default async function PaginaPedido({ params, searchParams }: Props) {
  const [{ id }, { nuevo }] = await Promise.all([params, searchParams]);
  const [pedido, config] = await Promise.all([obtenerPedidoPublico(id), obtenerConfiguracionPublica()]);
  if (!pedido) notFound();

  const { estado } = pedido;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-8 md:px-6 md:pt-12 xl:px-8">
      {nuevo === "1" && (
        <GuardarPedido id={pedido.id} numero={pedido.numeroPedido} total={pedido.total} fecha={pedido.creadoEn} />
      )}
      <Encabezado pedido={pedido} mensajeExito={config.mensajeExito} />

      <div className="mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
        {/* Sin la tarjeta de pago arriba, el primer título baja lo que mide su borde y relleno: queda a la par
            del título del resumen. */}
        <div className={`space-y-10 lg:col-span-7 ${estado === "nuevo" ? "" : "lg:pt-[25px]"}`}>
          {estado === "cancelado" ? (
            <AvisoCancelado numero={pedido.numeroPedido} whatsappNegocio={config.whatsappNegocio} />
          ) : (
            <>
              {estado === "nuevo" && (
                <TarjetaPago
                  pedido={pedido}
                  pago={config.pago}
                  envioInfo={config.envioInfo}
                  whatsappNegocio={config.whatsappNegocio}
                />
              )}
              <PasosPedido estado={estado} total={pedido.total} conDatosDePago={config.pago.numero !== null} />
            </>
          )}
        </div>

        <div className="mt-10 border-t border-linea pt-8 lg:col-span-5 lg:mt-0 lg:rounded-md lg:border lg:p-6">
          <ResumenPedido pedido={pedido} />
        </div>
      </div>

      <BotonEnlace href="/" variante="secundario" className="mt-10 w-full sm:w-auto">
        Volver al catálogo
      </BotonEnlace>
    </main>
  );
}
