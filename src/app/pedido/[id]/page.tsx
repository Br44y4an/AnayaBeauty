import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPedidoPorId } from "@/lib/data/orders";
import { obtenerConfiguracionPublica } from "@/lib/data/catalog";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { IconoWhatsApp, IconoCheck } from "@/components/ui/Iconos";

export const metadata = { title: "¡Pedido confirmado! — Anaya Beauty" };
export const dynamic = "force-dynamic";

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [pedido, config] = await Promise.all([
    obtenerPedidoPorId(id),
    obtenerConfiguracionPublica(),
  ]);

  if (!pedido) notFound();

  const mensajeWhatsApp =
    `¡Hola! Acabo de hacer mi pedido ${pedido.numeroPedido} ` +
    `a nombre de ${pedido.clienteNombre} por ${pesos(pedido.total)} 💕`;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 text-center">
      <div className="flex justify-center pt-12">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fucsia text-petalo">
          <IconoCheck className="h-8 w-8" />
        </span>
      </div>

      <h1 className="pt-5 font-display text-3xl leading-tight text-fucsia">
        {config.mensaje_exito ?? "¡Gracias por tu compra, princesa! ✨"}
      </h1>

      <p className="pt-3 text-sm text-carbon-suave">
        Guarda este número, es tu comprobante:
      </p>

      <p className="py-3 font-display text-5xl tracking-wide text-carbon">
        {pedido.numeroPedido}
      </p>

      <div className="space-y-3 rounded-tarjeta bg-petalo p-5 text-left shadow-petalo">
        <div>
          <p className="text-sm text-carbon">
            A nombre de <strong>{pedido.clienteNombre}</strong>
          </p>
          <p className="text-sm text-carbon-suave">
            {pedido.clienteCiudad} · {pedido.clienteWhatsapp}
          </p>
        </div>

        <ul className="space-y-2 border-t border-rosa-nube pt-3">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="text-[11px] font-bold text-lila">{l.referencia}</span>{" "}
                {l.nombre}{" "}
                <span className="text-carbon-suave">x{l.cantidad}</span>
              </span>
              <span className="shrink-0 font-semibold text-carbon">{pesos(l.subtotal)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-rosa-nube pt-3">
          <span className="font-display text-lg text-carbon">Total</span>
          <span className="font-display text-xl text-fucsia">{pesos(pedido.total)}</span>
        </div>
      </div>

      {config.pago_numero && (
        <div className="mt-4 space-y-1 rounded-tarjeta bg-lila-suave/30 p-5">
          <p className="text-sm font-semibold text-carbon">Para completar tu pago</p>
          <p className="font-display text-2xl text-lila">{config.pago_metodo}</p>
          <p className="text-xl font-bold tracking-wide text-carbon">{config.pago_numero}</p>
          {config.pago_titular && (
            <p className="text-xs text-carbon-suave">a nombre de {config.pago_titular}</p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <a
          href={enlaceWhatsApp(mensajeWhatsApp)}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Boton ancho>
            <IconoWhatsApp /> Enviar mi comprobante
          </Boton>
        </a>

        <Link href="/" className="block">
          <Boton variante="fantasma" ancho>
            Seguir viendo el catálogo
          </Boton>
        </Link>
      </div>

      <p className="pt-10 text-xs text-carbon-suave">
        Anaya Beauty · Belleza que te define ♡
      </p>
    </main>
  );
}
