import { Boton, BotonEnlace, estilosBoton } from "@/components/ui/Boton";
import { IconoAlerta, IconoChevron, IconoWhatsApp } from "@/components/ui/Iconos";
import { Insignia } from "@/components/ui/Insignia";
import {
  enlaceClienta,
  mensajeCobro,
  mensajeContacto,
  mensajeEnvio,
  NOMBRE_ESTADO,
  puedeCancelar,
  separarAdicional,
  siguientePaso,
} from "@/lib/admin/pedidos";
import { fechaHora, pesos } from "@/lib/format";
import type { ConfiguracionPublica, EstadoPedido, Pedido } from "@/lib/types";

const TONO_ESTADO = { nuevo: "alerta", pagado: "ahorro", enviado: "neutro", cancelado: "error" } as const;

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Qué mensaje de WhatsApp toca según el estado: cobrar, avisar el envío o solo escribirle. */
function whatsappDe(p: Pedido, pago: ConfiguracionPublica["pago"]) {
  const [corta, larga, mensaje] =
    p.estado === "nuevo"
      ? ["Cobrar", "Cobrar por WhatsApp", mensajeCobro(p, pago)]
      : p.estado === "enviado"
        ? ["Avisar envío", "Avisar envío", mensajeEnvio(p)]
        : ["Escribirle", "Escribirle", mensajeContacto(p)];
  const href = enlaceClienta(p.clienteWhatsapp, mensaje);
  return href ? { corta, larga, href } : null;
}

export function TarjetaPedido({
  pedido: p,
  pago,
  recienLlegado,
  guardando,
  enEspera,
  error,
  alCambiar,
  alPedirCancelar,
}: {
  pedido: Pedido;
  pago: ConfiguracionPublica["pago"];
  recienLlegado: boolean;
  /** El estado al que se está pasando este pedido mientras se guarda. */
  guardando: EstadoPedido | null;
  /** Otro cambio está en curso: se espera a que termine. */
  enEspera: boolean;
  error: string | null;
  alCambiar: (destino: EstadoPedido) => void;
  alPedirCancelar: () => void;
}) {
  const paso = siguientePaso(p.estado);
  const whatsapp = whatsappDe(p, pago);
  const { adicionalA, nota } = separarAdicional(p.notasCliente);
  const unidades = p.lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const productos = new Set(p.lineas.map((l) => l.referencia)).size;
  const idTitulo = `pedido-${p.id}`;
  const idError = `pedido-${p.id}-error`;
  const extras = [p.porMayor && "Por mayor", p.porcentajeDescuento > 0 && `${p.porcentajeDescuento} % de descuento`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      aria-labelledby={idTitulo}
      className={`rounded-md border p-4 ${recienLlegado ? "border-tinta" : "border-linea"}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id={idTitulo} className="text-[17px] font-bold leading-[22px] tabular-nums text-tinta">
            {p.numeroPedido}
          </h2>
          <p className="mt-0.5 text-[13px] leading-[18px] text-tinta-suave">
            <time dateTime={p.creadoEn}>{fechaHora(p.creadoEn)}</time>
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {recienLlegado && <Insignia>Recién llegado</Insignia>}
          <Insignia tono={TONO_ESTADO[p.estado]}>{NOMBRE_ESTADO[p.estado]}</Insignia>
        </div>
      </header>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-6 text-tinta">{p.clienteNombre}</p>
          <p className="text-sm leading-5 text-tinta-suave">
            {p.clienteCiudad} · <span className="tabular-nums">{p.clienteWhatsapp}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[17px] font-bold leading-[22px] tabular-nums text-tinta">{pesos(p.total)}</p>
          {extras && <p className="text-[13px] leading-[18px] text-tinta-suave">{extras}</p>}
        </div>
      </div>

      {adicionalA && (
        <p className="mt-3 rounded-md bg-alerta-fondo px-3 py-2 text-sm leading-5 text-tinta">
          <strong className="font-semibold">Adicional a {adicionalA}.</strong> Empácalo junto con ese pedido.
        </p>
      )}
      {nota && (
        <p className="mt-2 rounded-md bg-superficie px-3 py-2 text-sm leading-5 text-tinta">
          <span className="font-semibold">Nota de la clienta:</span> {nota}
        </p>
      )}

      <details className="group mt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-medium text-tinta [&::-webkit-details-marker]:hidden">
          {plural(productos, "producto", "productos")} · {plural(unidades, "unidad", "unidades")}
          <IconoChevron tamano={20} className="shrink-0 text-tinta-suave transition-transform group-open:rotate-180" />
        </summary>
        <LineasPedido pedido={p} />
      </details>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {paso && (
          <Boton
            type="button"
            variante="secundario"
            tamano="compacto"
            cargando={guardando === paso.estado}
            disabled={enEspera || guardando !== null}
            aria-describedby={error ? idError : undefined}
            onClick={() => alCambiar(paso.estado)}
          >
            {paso.etiqueta}
          </Boton>
        )}
        {whatsapp && (
          <a
            href={whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={estilosBoton({ variante: "contorno", tamano: "compacto", className: "px-3" })}
          >
            <IconoWhatsApp tamano={20} />
            {/* En el celular la tarjeta tiene dos columnas: el icono ya dice «por WhatsApp». */}
            <span className="sm:hidden">{whatsapp.corta}</span>
            <span className="hidden sm:inline">{whatsapp.larga}</span>
            <span className="sr-only"> (abre WhatsApp)</span>
          </a>
        )}
        <BotonEnlace href={`/admin/recibos?pedido=${p.id}`} variante="contorno" tamano="compacto">
          Recibo
        </BotonEnlace>
        {puedeCancelar(p.estado) && (
          <Boton
            type="button"
            variante="peligro"
            tamano="compacto"
            className="sm:ml-auto"
            cargando={guardando === "cancelado"}
            disabled={enEspera || guardando !== null}
            onClick={alPedirCancelar}
          >
            Cancelar
          </Boton>
        )}
      </div>

      {error && (
        <p id={idError} role="alert" className="mt-3 flex items-start gap-1.5 text-sm leading-5 text-error">
          <IconoAlerta tamano={18} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </article>
  );
}

function LineasPedido({ pedido: p }: { pedido: Pedido }) {
  return (
    <div className="pb-1">
      <ul className="divide-y divide-linea border-t border-linea">
        {p.lineas.map((l) => (
          <li key={l.id} className="flex justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                Ref. {l.referencia}
              </p>
              <p className="text-[15px] leading-5 text-tinta">
                {l.nombre}
                {l.tono && <span className="font-semibold"> · {l.tono}</span>}
              </p>
              <p className="text-[13px] leading-[18px] tabular-nums text-tinta-suave">
                {l.cantidad} × {pesos(l.precioUnitarioAplicado)} c/u
              </p>
            </div>
            <p className="shrink-0 text-[15px] font-semibold tabular-nums text-tinta">{pesos(l.subtotal)}</p>
          </li>
        ))}
      </ul>
      {p.descuento > 0 && (
        <dl className="space-y-1 border-t border-linea pt-2.5 text-sm leading-5">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Subtotal</dt>
            <dd className="tabular-nums text-tinta">{pesos(p.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-suave">
              Descuento{p.porcentajeDescuento > 0 ? ` (${p.porcentajeDescuento} %)` : ""}
            </dt>
            <dd className="tabular-nums text-ahorro">−{pesos(p.descuento)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-tinta">
            <dt>Total productos</dt>
            <dd className="tabular-nums">{pesos(p.total)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
