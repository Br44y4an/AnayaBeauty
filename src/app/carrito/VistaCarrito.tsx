"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usarCarrito } from "@/lib/cart";
import {
  cargarCarrito,
  confirmarPedido,
  type DatosCarrito,
  type ResultadoConfirmacion,
} from "./actions";
import {
  reconciliarCarrito,
  itemsParaPedido,
  explicarLinea,
  type LineaReconciliada,
} from "@/lib/carrito/reconciliar";
import { calcularTotales, unitarioDeLinea, siguienteBeneficio } from "@/lib/discounts";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { Esqueleto } from "@/components/ui/Esqueleto";
import {
  IconoMas,
  IconoMenos,
  IconoCorazon,
  IconoWhatsApp,
  IconoBasura,
  IconoAlerta,
  IconoCheck,
} from "@/components/ui/Iconos";

/**
 * Bolsa y confirmación, en una sola pantalla.
 *
 * POR QUÉ SE JUNTARON
 *
 * El recorrido era: catálogo → bolsa → confirmar → listo, y en medio
 * había que salir a WhatsApp a pedir un código de 4 dígitos, esperar
 * respuesta y volver. Cuatro pantallas y una espera para comprar un
 * labial. Ahora la bolsa y los datos viven juntos: se revisa, se
 * escribe y se confirma sin cambiar de página.
 *
 * LO QUE SE VE ES LO QUE SE ENVÍA
 *
 * Todo lo que se pinta aquí sale de `reconciliarCarrito`, y lo que se
 * manda al servidor sale de la MISMA estructura. Antes la pantalla
 * escondía las líneas sin stock y el formulario las enviaba igual, así
 * que el pedido se caía en el último paso con un error que hablaba de un
 * producto que ya no estaba en pantalla.
 */
export function VistaCarrito() {
  const router = useRouter();
  const lineas = usarCarrito((e) => e.lineas);
  const establecer = usarCarrito((e) => e.establecer);
  const quitar = usarCarrito((e) => e.quitar);
  const vaciar = usarCarrito((e) => e.vaciar);
  const claveEnvio = usarCarrito((e) => e.claveEnvio);
  const prepararEnvio = usarCarrito((e) => e.prepararEnvio);

  const [datos, setDatos] = useState<DatosCarrito | null>(null);
  const [falloCarga, setFalloCarga] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const [estado, accion, enviando] = useActionState<ResultadoConfirmacion | null, FormData>(
    confirmarPedido,
    null
  );

  const avisoRef = useRef<HTMLDivElement>(null);

  // Los identificadores en texto evitan recargar cuando solo cambia una
  // cantidad: los precios y el stock no dependen de cuántas lleve.
  const idsClave = useMemo(
    () => [...new Set(lineas.map((l) => l.productoId))].sort().join(","),
    [lineas]
  );

  useEffect(() => {
    let vigente = true;
    setFalloCarga(false);

    cargarCarrito(idsClave ? idsClave.split(",") : [])
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && setFalloCarga(true));

    return () => {
      vigente = false;
    };
  }, [idsClave]);

  // Clave del envío: si el mismo formulario llega dos veces al servidor,
  // devuelve el pedido que ya creó en vez de duplicarlo.
  useEffect(() => {
    if (!claveEnvio && lineas.length > 0) prepararEnvio();
  }, [claveEnvio, lineas.length, prepararEnvio]);

  // Al confirmar se marca ANTES de vaciar: si se vaciara primero, entre
  // el vaciado y la navegación aparecía un parpadeo de "bolsa vacía"
  // justo después de haber comprado, que es el peor momento posible.
  useEffect(() => {
    if (!estado?.ok) return;
    setConfirmado(true);
    router.push(`/pedido/${estado.pedidoId}`);
    vaciar();
  }, [estado, router, vaciar]);

  // Un error del servidor tiene que verse, aunque el formulario esté
  // más abajo de lo que cabe en la pantalla.
  useEffect(() => {
    if (estado && !estado.ok) {
      avisoRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [estado]);

  if (confirmado) return <PantallaConfirmando />;

  if (falloCarga) {
    return (
      <div className="space-y-4 rounded-tarjeta bg-petalo p-6 text-center shadow-petalo">
        <p className="font-display text-xl text-carbon">No pudimos cargar tu bolsa</p>
        <p className="text-carbon-suave">
          Revisa tu conexión. Lo que elegiste sigue guardado: no se perdió nada.
        </p>
        <Boton onClick={() => router.refresh()}>Reintentar</Boton>
      </div>
    );
  }

  if (!datos) return <EsqueletoCarrito />;

  if (lineas.length === 0) return <BolsaVacia />;

  /* ---------- Lo que de verdad se puede pedir ---------- */
  const disponibilidad = datos.productos.map((p) => ({
    id: p.id,
    stock: p.stock,
    // Un producto sin precio configurado no se puede cobrar: para la
    // clienta es exactamente lo mismo que si no estuviera.
    activo: p.activo && p.escalones.length > 0,
  }));

  const carrito = reconciliarCarrito(lineas, disponibilidad);
  const porId = new Map(datos.productos.map((p) => [p.id, p]));

  const lineasCalculo = carrito.pedibles.map((l) => ({
    productoId: l.linea.productoId,
    escalones: porId.get(l.linea.productoId)?.escalones ?? [],
    cantidad: l.cantidad,
  }));

  const totales = calcularTotales(lineasCalculo, datos.reglas, datos.umbralPorMayor);
  const empujon = siguienteBeneficio(totales.subtotalNormal, datos.reglas, datos.umbralPorMayor);
  const items = itemsParaPedido(carrito);

  /** Deja la bolsa exactamente como la pantalla la está mostrando. */
  function ajustarBolsa() {
    for (const l of carrito.lineas) {
      if (l.estado === "ok") continue;
      establecer(l.linea.productoId, l.linea.tonoId, l.cantidad);
    }
  }

  const nombreDe = (l: LineaReconciliada) =>
    porId.get(l.linea.productoId)?.nombre ?? "Un producto";

  return (
    <div className="space-y-5">
      <Pasos />

      {/* ---------- Avisos de lo que cambió ---------- */}
      {carrito.hayCambios && (
        <section
          role="status"
          className="space-y-3 rounded-tarjeta border-2 border-alerta/30 bg-alerta-fondo p-4"
        >
          <p className="flex items-center gap-2 font-bold text-alerta">
            <IconoAlerta className="h-5 w-5 shrink-0" />
            Tu bolsa cambió mientras la armabas
          </p>

          <ul className="space-y-1 text-[15px] text-carbon">
            {carrito.conProblema.map((l) => (
              <li key={`${l.linea.productoId}-${l.linea.tonoId ?? "sin"}`}>
                · {explicarLinea(l, nombreDe(l))}
              </li>
            ))}
          </ul>

          <p className="text-sm text-carbon-suave">
            Ya ajustamos los totales: solo vas a pagar lo que ves abajo.
          </p>

          <Boton variante="secundario" onClick={ajustarBolsa}>
            <IconoCheck className="h-5 w-5" /> Entendido, actualizar mi bolsa
          </Boton>
        </section>
      )}

      {/* ---------- Líneas ---------- */}
      <section aria-label="Productos en tu bolsa" className="space-y-3">
        {carrito.lineas.map((l) => {
          const producto = porId.get(l.linea.productoId);
          const clave = `${l.linea.productoId}-${l.linea.tonoId ?? "sin"}`;

          if (!producto || l.cantidad < 1) {
            return (
              <LineaCaida
                key={clave}
                nombre={producto?.nombre ?? "Producto no disponible"}
                tono={l.linea.tonoNombre}
                motivo={explicarLinea(l, producto?.nombre ?? "Este producto") ?? ""}
                alQuitar={() => quitar(l.linea.productoId, l.linea.tonoId)}
              />
            );
          }

          const unitario = unitarioDeLinea(
            {
              productoId: producto.id,
              escalones: producto.escalones,
              cantidad: l.cantidad,
            },
            lineasCalculo,
            totales.porMayor
          );

          const usadasDelProducto = carrito.pedibles
            .filter((x) => x.linea.productoId === producto.id)
            .reduce((n, x) => n + x.cantidad, 0);

          return (
            <LineaBolsa
              key={clave}
              nombre={producto.nombre}
              referencia={producto.referencia}
              imagen={producto.imagenPrincipal}
              tono={l.linea.tonoNombre}
              cantidad={l.cantidad}
              unitario={unitario}
              puedeSumar={usadasDelProducto < producto.stock}
              alCambiar={(n) => establecer(l.linea.productoId, l.linea.tonoId, n)}
              alQuitar={() => quitar(l.linea.productoId, l.linea.tonoId)}
            />
          );
        })}
      </section>

      {items.length === 0 ? (
        <div className="space-y-4 rounded-tarjeta bg-petalo p-6 text-center shadow-petalo">
          <p className="font-display text-xl text-carbon">
            No queda nada que podamos despachar
          </p>
          <p className="text-carbon-suave">
            Todo lo que tenías se agotó o salió del catálogo. Vuelve al catálogo
            y elige de nuevo ♡
          </p>
          <Link href="/" className="inline-block">
            <Boton>Ver el catálogo</Boton>
          </Link>
        </div>
      ) : (
        <>
          {empujon && (
            <p className="rounded-tarjeta bg-lila-suave/40 px-4 py-3 text-center text-[15px] text-lila-texto">
              ✨ Te faltan <strong>{pesos(empujon.falta)}</strong> para {empujon.descripcion}
            </p>
          )}

          <Desglose totales={totales} />

          <FormularioDatos
            accion={accion}
            enviando={enviando}
            estado={estado}
            items={items}
            clave={claveEnvio ?? ""}
            avisoRef={avisoRef}
          />

          <QuePasaDespues pago={datos.pago} />

          <BarraTotal total={totales.total} enviando={enviando} />
        </>
      )}
    </div>
  );
}

/* =====================================================================
   Piezas
   ===================================================================== */

function Pasos() {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Pasos de tu compra">
      {[
        { n: 1, texto: "Tu bolsa", activo: true },
        { n: 2, texto: "Tus datos", activo: true },
        { n: 3, texto: "Listo", activo: false },
      ].map((p, i) => (
        <li key={p.n} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="h-px w-4 bg-lila-suave" />}
          <span
            className={`flex items-center gap-1.5 rounded-pastilla px-3 py-1.5 font-semibold ${
              p.activo ? "bg-fucsia/10 text-fucsia-texto" : "text-carbon-suave"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                p.activo ? "bg-fucsia text-petalo" : "bg-lila-suave text-carbon-suave"
              }`}
            >
              {p.n}
            </span>
            {p.texto}
          </span>
        </li>
      ))}
    </ol>
  );
}

function LineaBolsa({
  nombre,
  referencia,
  imagen,
  tono,
  cantidad,
  unitario,
  puedeSumar,
  alCambiar,
  alQuitar,
}: {
  nombre: string;
  referencia: string;
  imagen: string | null;
  tono: string | null;
  cantidad: number;
  unitario: number;
  puedeSumar: boolean;
  alCambiar: (n: number) => void;
  alQuitar: () => void;
}) {
  const botonCantidad =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full " +
    "transition duration-200 disabled:opacity-30";

  return (
    <article className="flex gap-3 rounded-tarjeta bg-petalo p-3 shadow-petalo">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
        {imagen ? (
          <Image src={imagen} alt={nombre} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-lila-suave">
            <IconoCorazon className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-lila-texto">{referencia}</p>
        <h3 className="text-[15px] font-semibold leading-snug text-carbon">{nombre}</h3>

        {tono && (
          <p className="text-sm font-semibold text-lila-texto">Tono: {tono}</p>
        )}

        <p className="text-sm text-carbon-suave">{pesos(unitario)} c/u</p>

        <div className="mt-2 flex items-center gap-3">
          <button
            aria-label={`Quitar uno de ${nombre}`}
            onClick={() => alCambiar(cantidad - 1)}
            className={`${botonCantidad} border-2 border-fucsia-suave text-fucsia-texto`}
          >
            <IconoMenos className="h-5 w-5" />
          </button>

          <span aria-live="polite" className="w-7 text-center text-lg font-bold text-carbon">
            {cantidad}
          </span>

          <button
            aria-label={`Agregar uno de ${nombre}`}
            disabled={!puedeSumar}
            onClick={() => alCambiar(cantidad + 1)}
            className={`${botonCantidad} bg-fucsia text-petalo`}
          >
            <IconoMas className="h-5 w-5" />
          </button>

          <button
            onClick={alQuitar}
            aria-label={`Quitar ${nombre} de la bolsa`}
            className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center
                       rounded-full text-carbon-suave transition hover:bg-rosa-nube
                       hover:text-fucsia-texto"
          >
            <IconoBasura className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p className="shrink-0 self-center text-lg font-bold text-fucsia-texto">
        {pesos(unitario * cantidad)}
      </p>
    </article>
  );
}

function LineaCaida({
  nombre,
  tono,
  motivo,
  alQuitar,
}: {
  nombre: string;
  tono: string | null;
  motivo: string;
  alQuitar: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-tarjeta border-2 border-dashed
                        border-lila-suave bg-petalo/60 p-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-carbon-suave line-through">
          {nombre}
          {tono && ` · ${tono}`}
        </h3>
        <p className="text-sm text-carbon-suave">{motivo}</p>
      </div>

      <Boton variante="peligro" onClick={alQuitar}>
        <IconoBasura className="h-5 w-5" /> Quitar
      </Boton>
    </article>
  );
}

function Desglose({ totales }: { totales: ReturnType<typeof calcularTotales> }) {
  return (
    <div className="space-y-2 rounded-tarjeta bg-petalo p-5 shadow-petalo">
      <div className="flex justify-between text-[15px] text-carbon-suave">
        <span>Subtotal</span>
        <span>{pesos(totales.subtotalNormal)}</span>
      </div>

      {totales.porMayor && (
        <div className="flex justify-between text-[15px] font-semibold text-lila-texto">
          <span>🎉 Precio por mayor</span>
          <span>−{pesos(totales.subtotalNormal - totales.subtotalBase)}</span>
        </div>
      )}

      {totales.porcentaje > 0 && (
        <div className="flex justify-between text-[15px] font-semibold text-lila-texto">
          <span>Descuento {totales.porcentaje}%</span>
          <span>−{pesos(totales.descuento)}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-rosa-nube pt-3">
        <span className="font-display text-xl text-carbon">Total</span>
        <span className="font-display text-2xl text-fucsia-texto">{pesos(totales.total)}</span>
      </div>

      {totales.ahorroTotal > 0 && (
        <p className="pt-1 text-center text-[15px] font-semibold text-exito">
          ✨ Estás ahorrando {pesos(totales.ahorroTotal)}
        </p>
      )}
    </div>
  );
}

const CAMPO =
  "min-h-[52px] w-full rounded-suave border-2 bg-petalo px-4 py-3 text-base " +
  "text-carbon outline-none transition duration-200 placeholder:text-carbon-suave/60";

function Campo({
  nombre,
  etiqueta,
  ayuda,
  conError,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  conError?: boolean;
}) {
  const idAyuda = ayuda ? `${nombre}-ayuda` : undefined;

  return (
    <label className="block" htmlFor={nombre}>
      <span className="mb-1 block font-semibold text-carbon">{etiqueta}</span>
      {ayuda && (
        <span id={idAyuda} className="mb-1.5 block text-sm text-carbon-suave">
          {ayuda}
        </span>
      )}
      <input
        {...props}
        id={nombre}
        name={nombre}
        aria-describedby={idAyuda}
        aria-invalid={conError || undefined}
        className={`${CAMPO} ${
          conError ? "border-fucsia bg-fucsia/5" : "border-lila-suave focus:border-fucsia"
        }`}
      />
    </label>
  );
}

function FormularioDatos({
  accion,
  enviando,
  estado,
  items,
  clave,
  avisoRef,
}: {
  accion: (datos: FormData) => void;
  enviando: boolean;
  estado: ResultadoConfirmacion | null;
  items: { producto_id: string; cantidad: number; tono: string | null }[];
  clave: string;
  avisoRef: React.RefObject<HTMLDivElement | null>;
}) {
  const error = estado && !estado.ok ? estado : null;

  return (
    <form id="form-pedido" action={accion} className="space-y-4 rounded-tarjeta bg-petalo p-5 shadow-petalo">
      {/* Lo que se envía sale de la reconciliación, igual que lo que se
          pintó arriba: no puede haber discrepancia entre ambos. */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="clave" value={clave} />

      <div>
        <h2 className="font-display text-xl text-carbon">¿A quién le enviamos?</h2>
        <p className="text-sm text-carbon-suave">
          Solo lo necesario para despachar tu pedido.
        </p>
      </div>

      <Campo
        nombre="nombre"
        etiqueta="Tu nombre completo"
        required
        maxLength={80}
        autoComplete="name"
        placeholder="María Fernanda Gómez"
        conError={error?.campo === "nombre"}
      />

      <Campo
        nombre="whatsapp"
        etiqueta="Tu WhatsApp"
        ayuda="Por ahí te confirmamos el pago y el envío."
        required
        type="tel"
        inputMode="tel"
        maxLength={20}
        autoComplete="tel"
        placeholder="300 123 4567"
        conError={error?.campo === "whatsapp"}
      />

      <Campo
        nombre="ciudad"
        etiqueta="Tu ciudad"
        required
        maxLength={60}
        autoComplete="address-level2"
        placeholder="Medellín"
        conError={error?.campo === "ciudad"}
      />

      <label className="block" htmlFor="notas">
        <span className="mb-1 block font-semibold text-carbon">
          ¿Algo que debamos saber?{" "}
          <span className="font-normal text-carbon-suave">(opcional)</span>
        </span>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          maxLength={400}
          placeholder="Es un regalo, timbre 302, llamar antes de llegar…"
          className={`${CAMPO} resize-none border-lila-suave focus:border-fucsia`}
        />
      </label>

      <div ref={avisoRef}>
        {error && (
          <div role="alert" className="space-y-2 rounded-suave bg-fucsia/10 p-4 text-center">
            <p className="font-semibold text-fucsia-texto">{error.mensaje}</p>
            <a
              href={enlaceWhatsApp("Hola, tuve un problema al confirmar mi pedido")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold
                         text-carbon-suave underline underline-offset-4"
            >
              <IconoWhatsApp className="h-4 w-4" />
              Escribirnos por WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* Botón dentro del formulario para quien navega con teclado y para
          cuando la barra inferior no está a la vista. */}
      <Boton ancho tamano="grande" type="submit" cargando={enviando}>
        {enviando ? "Confirmando tu pedido…" : "Confirmar mi pedido 💕"}
      </Boton>

      <p className="text-center text-sm text-carbon-suave">
        Al confirmar apartamos tus productos a tu nombre. El pago lo coordinas
        después por WhatsApp: aquí no se cobra nada.
      </p>
    </form>
  );
}

function QuePasaDespues({ pago }: { pago: DatosCarrito["pago"] }) {
  const pasos = [
    "Confirmas y te damos tu número de pedido al instante.",
    pago.numero
      ? `Pagas por ${pago.metodo ?? "transferencia"} al ${pago.numero}${pago.titular ? ` (${pago.titular})` : ""}.`
      : "Te escribimos por WhatsApp para coordinar el pago.",
    "Nos mandas el comprobante por WhatsApp con un toque.",
    "Despachamos y te avisamos cuando salga.",
  ];

  return (
    <section className="rounded-tarjeta bg-lila-suave/30 p-5">
      <h2 className="pb-2 font-display text-lg text-carbon">Qué pasa después</h2>
      <ol className="space-y-2">
        {pasos.map((p, i) => (
          <li key={p} className="flex gap-3 text-[15px] text-carbon">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                         bg-petalo text-sm font-bold text-lila-texto"
            >
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Barra inferior con el total siempre a la vista.
 *
 * El botón vive fuera del formulario y lo envía con `form=`: así el
 * total y la acción acompañan a la clienta por toda la pantalla sin
 * duplicar el formulario ni romper el envío con teclado.
 */
function BarraTotal({ total, enviando }: { total: number; enviando: boolean }) {
  return (
    <div className="margen-seguro fixed bottom-0 left-0 right-0 z-40 border-t border-lila-suave
                    bg-petalo/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-carbon-suave">Total a pagar</p>
          <p className="font-display text-xl leading-tight text-fucsia-texto">
            {pesos(total)}
          </p>
        </div>

        <Boton
          form="form-pedido"
          type="submit"
          cargando={enviando}
          className="ml-auto flex-1"
        >
          {enviando ? "Enviando…" : "Confirmar"}
        </Boton>
      </div>
    </div>
  );
}

function PantallaConfirmando() {
  return (
    <div role="status" className="space-y-4 py-24 text-center">
      <span className="mx-auto flex h-16 w-16 animate-[rebote_0.6s_ease] items-center
                       justify-center rounded-full bg-fucsia text-petalo">
        <IconoCheck className="h-8 w-8" />
      </span>
      <p className="font-display text-2xl text-carbon">¡Pedido confirmado!</p>
      <p className="text-carbon-suave">Te estamos llevando a tu comprobante…</p>
    </div>
  );
}

function BolsaVacia() {
  return (
    <div className="space-y-5 py-16 text-center">
      <p className="flex justify-center text-lila-suave">
        <IconoCorazon className="h-16 w-16" />
      </p>
      <p className="font-display text-2xl text-carbon">Tu bolsa está vacía</p>
      <p className="text-carbon-suave">Vuelve al catálogo y consiéntete ♡</p>
      <Link href="/" className="inline-block">
        <Boton tamano="grande">Ver el catálogo</Boton>
      </Link>
    </div>
  );
}

function EsqueletoCarrito() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando tu pedido">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-tarjeta bg-petalo p-3 shadow-petalo">
          <Esqueleto className="h-24 w-24 shrink-0" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-3 w-16" />
            <Esqueleto className="h-4 w-3/4" />
            <Esqueleto className="h-11 w-40 rounded-pastilla" />
          </div>
        </div>
      ))}
      <Esqueleto className="h-36 w-full rounded-tarjeta" />
    </div>
  );
}
