import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPedidoPorId } from "@/lib/data/orders";
import { obtenerConfiguracionPublica } from "@/lib/data/catalog";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { IconoWhatsApp, IconoCheck } from "@/components/ui/Iconos";
import { CopiarDato } from "./CopiarDato";

export const metadata = { title: "¡Pedido confirmado! — Anaya Beauty" };
export const dynamic = "force-dynamic";

/**
 * Pantalla de éxito.
 *
 * Aquí termina la compra, así que aquí es donde hay que dejar todo
 * clarísimo: qué pediste, cuánto es, a dónde se paga y qué sigue. Antes
 * el número de pago se mostraba pero había que copiarlo a mano de la
 * pantalla al banco, tecleando 10 dígitos sin equivocarse; ahora se copia
 * con un toque.
 *
 * El identificador del pedido es un UUID y funciona como llave de acceso:
 * permite volver a esta pantalla desde el chat sin tener que iniciar
 * sesión, y no se puede adivinar el pedido de otra persona.
 */
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
    <main className="mx-auto max-w-md px-4 pb-24">
      <div className="flex justify-center pt-12">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-fucsia text-petalo">
          <IconoCheck className="h-10 w-10" />
        </span>
      </div>

      <h1 className="pt-5 text-center font-display text-3xl leading-tight text-fucsia-texto">
        {config.mensaje_exito ?? "¡Gracias por tu compra, princesa! ✨"}
      </h1>

      <p className="pt-3 text-center text-carbon-suave">
        Guarda este número, es tu comprobante:
      </p>

      <p className="py-2 text-center font-display text-5xl tracking-wide text-carbon">
        {pedido.numeroPedido}
      </p>

      {/* ---- Qué pasa ahora ---- */}
      <section className="mt-4 rounded-tarjeta bg-lila-suave/30 p-5">
        <h2 className="pb-3 font-display text-lg text-carbon">Qué sigue ahora</h2>
        <ol className="space-y-3">
          {[
            {
              titulo: "Ya apartamos tus productos",
              texto: "Quedaron reservados a tu nombre. No tienes que hacer nada más aquí.",
              hecho: true,
            },
            {
              titulo: "Haz el pago",
              texto: config.pago_numero
                ? `Transfiere ${pesos(pedido.total)} a los datos que están abajo.`
                : "Te escribimos por WhatsApp para coordinarlo.",
            },
            {
              titulo: "Mándanos el comprobante",
              texto: "Con el botón de abajo se abre el chat con tu pedido ya escrito.",
            },
            {
              titulo: "Te avisamos al despachar",
              texto: "Apenas salga tu paquete te escribimos por WhatsApp.",
            },
          ].map((paso, i) => (
            <li key={paso.titulo} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                  text-sm font-bold ${
                    paso.hecho
                      ? "bg-exito text-petalo"
                      : "bg-petalo text-lila-texto"
                  }`}
              >
                {paso.hecho ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug text-carbon">{paso.titulo}</p>
                <p className="text-sm leading-snug text-carbon-suave">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Datos de pago ---- */}
      {config.pago_numero && (
        <section className="mt-4 space-y-2 rounded-tarjeta bg-petalo p-5 text-center shadow-petalo">
          <h2 className="font-semibold text-carbon">Para completar tu pago</h2>
          <p className="font-display text-2xl text-lila-texto">{config.pago_metodo}</p>

          <CopiarDato valor={config.pago_numero} />

          {config.pago_titular && (
            <p className="text-sm text-carbon-suave">
              a nombre de {config.pago_titular}
            </p>
          )}

          <p className="pt-1 text-lg font-bold text-carbon">
            Valor a pagar: <span className="text-fucsia-texto">{pesos(pedido.total)}</span>
          </p>
        </section>
      )}

      {/* ---- Resumen ---- */}
      <section className="mt-4 space-y-3 rounded-tarjeta bg-petalo p-5 text-left shadow-petalo">
        <div>
          <p className="text-[15px] text-carbon">
            A nombre de <strong>{pedido.clienteNombre}</strong>
          </p>
          <p className="text-sm text-carbon-suave">
            {pedido.clienteCiudad} · {pedido.clienteWhatsapp}
          </p>
          {pedido.notasCliente && (
            <p className="pt-1 text-sm text-carbon-suave">
              Nota: {pedido.notasCliente}
            </p>
          )}
        </div>

        <ul className="space-y-2 border-t border-rosa-nube pt-3">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex justify-between gap-2 text-[15px]">
              <span className="min-w-0">
                <span className="text-xs font-bold text-lila-texto">{l.referencia}</span>{" "}
                {l.nombre}
                {l.tono && (
                  <span className="font-semibold text-lila-texto"> · {l.tono}</span>
                )}{" "}
                <span className="text-carbon-suave">x{l.cantidad}</span>
              </span>
              <span className="shrink-0 font-semibold text-carbon">{pesos(l.subtotal)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-rosa-nube pt-3">
          {(pedido.porMayor || pedido.porcentajeDescuento > 0) && (
            <>
              <div className="flex justify-between text-[15px] text-carbon-suave">
                <span>Subtotal</span>
                <span>{pesos(pedido.subtotal)}</span>
              </div>

              {pedido.porMayor && (
                <p className="text-[15px] font-semibold text-lila-texto">
                  🎉 ¡Te aplicamos precio por mayor!
                </p>
              )}

              {pedido.porcentajeDescuento > 0 && (
                <div className="flex justify-between text-[15px] font-semibold text-lila-texto">
                  <span>Descuento {pedido.porcentajeDescuento}%</span>
                  <span>−{pesos(pedido.descuento)}</span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between pt-1">
            <span className="font-display text-lg text-carbon">Total</span>
            <span className="font-display text-2xl text-fucsia-texto">
              {pesos(pedido.total)}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-3">
        <a
          href={enlaceWhatsApp(mensajeWhatsApp)}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Boton ancho tamano="grande">
            <IconoWhatsApp /> Enviar mi comprobante
          </Boton>
        </a>

        <Link href="/" className="block">
          <Boton variante="secundario" ancho>
            Seguir viendo el catálogo
          </Boton>
        </Link>
      </div>

      <p className="pt-10 text-center text-sm text-carbon-suave">
        Anaya Beauty · Belleza que te define ♡
      </p>
    </main>
  );
}
