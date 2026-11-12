import Image from "next/image";
import {
  cierreDe,
  datosDePago,
  encabezadoDocumento,
  fechaLarga,
  filasDelTotal,
  lineasDestinatario,
  textoImprimible as t,
  type DatosRecibo,
} from "@/lib/admin/recibo";
import { pesos } from "@/lib/format";

const COLOR_FILA = { normal: "text-tinta-suave", ahorro: "text-ahorro", total: "text-tinta" } as const;

/** El recibo como saldrá en el PDF: mismos datos, mismos textos (también sin los caracteres que el PDF no escribe). */
export function VistaPreviaRecibo({ datos }: { datos: DatosRecibo }) {
  const detalle = lineasDestinatario(datos.destinatario).map(t);
  const pago = datosDePago(datos);
  const cierre = cierreDe(t(datos.nota));

  return (
    <section aria-labelledby="recibo-vista-titulo" className="space-y-3">
      <h2 id="recibo-vista-titulo" className="text-xl font-semibold leading-[26px] text-tinta">
        Vista previa
      </h2>
      <article className="overflow-hidden rounded-md border border-linea bg-fondo text-tinta">
        <header className="flex items-start justify-between gap-4 bg-superficie px-4 py-4 sm:px-5">
          <Image src="/marca/anaya-beauty.png" alt="Anaya Beauty" width={349} height={160} unoptimized className="h-9 w-auto shrink-0" />
          <div className="min-w-0 text-right">
            <p className="break-words text-[15px] font-bold leading-5">{t(encabezadoDocumento(datos.titulo, datos.numero))}</p>
            <p className="mt-0.5 text-[13px] leading-[18px] text-tinta-suave">{fechaLarga(datos.fecha)}</p>
          </div>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="rounded-md bg-superficie px-3 py-2.5">
            <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">Dirigido a</p>
            <p className="mt-1 break-words text-[15px] font-semibold leading-5">{t(datos.destinatario.nombre) || "Cliente"}</p>
            {detalle.map((renglon) => (
              <p key={renglon} className="break-words text-[13px] leading-[18px] text-tinta-suave">
                {renglon}
              </p>
            ))}
          </div>

          {datos.lineas.length > 0 ? (
            <ul className="divide-y divide-linea border-y border-linea">
              {datos.lineas.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    {l.referencia && (
                      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                        Ref. {t(l.referencia)}
                      </p>
                    )}
                    <p className="break-words text-sm leading-5">
                      {t(l.nombre)}
                      {l.tono && <span className="font-semibold"> · {t(l.tono)}</span>}
                    </p>
                    <p className="text-[13px] leading-[18px] tabular-nums text-tinta-suave">
                      {l.cantidad} × {pesos(l.precioUnitario)} c/u
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{pesos(l.subtotal)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-linea py-3 text-sm text-tinta-suave">Sin productos todavía.</p>
          )}

          <dl className="ml-auto max-w-64 space-y-1 text-sm leading-5">
            {filasDelTotal(datos, "−").map((fila) => (
              <div
                key={fila.etiqueta}
                className={`flex justify-between gap-4 ${COLOR_FILA[fila.tipo]} ${
                  fila.tipo === "total" ? "pt-1 text-base font-bold" : ""
                }`}
              >
                <dt>{fila.etiqueta}</dt>
                <dd className="tabular-nums">{fila.valor}</dd>
              </div>
            ))}
          </dl>

          {pago && (
            <div className="rounded-md bg-superficie px-3 py-2.5">
              <p className="text-sm font-semibold leading-5">Para completar tu pago</p>
              <p className="text-[15px] leading-6 tabular-nums">{t(pago.cuenta)}</p>
              {pago.titular && <p className="text-[13px] leading-[18px] text-tinta-suave">{t(pago.titular)}</p>}
            </div>
          )}

          <div className="border-t border-linea pt-3">
            {cierre.tipo === "nota" ? (
              cierre.parrafos.map((p, i) => (
                <p key={i} className="break-words text-sm leading-5">
                  {p}
                </p>
              ))
            ) : (
              <div className="text-center">
                <p className="text-sm font-semibold leading-5">{cierre.titulo}</p>
                <p className="text-[13px] leading-[18px] text-tinta-suave">{cierre.detalle}</p>
              </div>
            )}
          </div>
        </div>

        <p className="border-t border-linea px-4 py-2 text-center text-xs leading-4 text-tinta-suave">
          Anaya Beauty · Belleza que te define
        </p>
      </article>
    </section>
  );
}
