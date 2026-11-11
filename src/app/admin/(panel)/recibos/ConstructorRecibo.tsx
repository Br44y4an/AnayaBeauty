"use client";

import { useMemo, useState } from "react";
import { precioUnitarioPara } from "@/lib/pricing";
import { calcularTotales, unitarioDeLinea, type ReglaDescuento } from "@/lib/discounts";
import { pesos } from "@/lib/format";
import { descargarReciboPDF, type LineaRecibo } from "@/lib/pdf/recibo";
import { Boton } from "@/components/ui/Boton";
import { IconoMas } from "@/components/ui/Iconos";
import type { Pedido, Producto } from "@/lib/types";

const CAMPO = "mt-2 block min-h-12 w-full rounded-md border border-borde bg-fondo px-3.5 text-base text-tinta";
const ETIQUETA = "block text-[15px] font-semibold leading-5 text-tinta";
const PRECIO =
  "min-h-11 w-28 rounded-md border border-borde bg-fondo px-2 text-right text-base font-semibold tabular-nums text-tinta";
const CASILLA = "flex min-h-11 cursor-pointer select-none items-center gap-2 text-sm text-tinta";
const TARJETA = "rounded-md border border-linea p-4 sm:p-5";

type LineaManual = {
  productoId: string;
  tonoId: string | null;
  tonoNombre: string | null;
  cantidad: number;
};

function numeroSugerido(): string {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(
    hoy.getDate()
  ).padStart(2, "0")}`;
  return `REC-${fecha}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

export function ConstructorRecibo({
  pedidos,
  pedidoInicial = "",
  productos,
  reglas,
  umbralPorMayor,
  pagoMetodo,
  pagoNumero,
  pagoTitular,
}: {
  pedidos: Pedido[];
  /** `?pedido=id` desde la tarjeta del pedido: llega ya elegido. */
  pedidoInicial?: string;
  productos: Producto[];
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
  pagoMetodo: string | null;
  pagoNumero: string | null;
  pagoTitular: string | null;
}) {
  const [modo, setModo] = useState<"pedido" | "manual">("pedido");
  const [generando, setGenerando] = useState(false);

  // ---------- Modo: desde un pedido existente ----------
  const [pedidoId, setPedidoId] = useState(pedidoInicial);
  const pedido = pedidos.find((p) => p.id === pedidoId) ?? null;
  const [preciosPedidoOverride, setPreciosPedidoOverride] = useState<Record<string, number>>({});
  const [descuentoPedidoOverride, setDescuentoPedidoOverride] = useState<number | null>(null);
  const [mostrarDescuentoPedido, setMostrarDescuentoPedido] = useState(true);

  // ---------- Modo: manual ----------
  const [numero, setNumero] = useState(numeroSugerido);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteCiudad, setClienteCiudad] = useState("");
  const [lineas, setLineas] = useState<LineaManual[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [productoElegido, setProductoElegido] = useState<Producto | null>(null);
  const [tonoElegidoId, setTonoElegidoId] = useState<string>("");
  const [cantidadNueva, setCantidadNueva] = useState(1);
  const [preciosManualOverride, setPreciosManualOverride] = useState<Record<string, number>>({});
  const [descuentoManualOverride, setDescuentoManualOverride] = useState<number | null>(null);
  const [mostrarDescuentoManual, setMostrarDescuentoManual] = useState(true);

  const sugerencias = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(termino) ||
          p.referencia.toLowerCase().includes(termino)
      )
      .slice(0, 8);
  }, [busqueda, productos]);

  function agregarLinea() {
    if (!productoElegido) return;
    const tono = (productoElegido.variantes ?? []).find((t) => t.id === tonoElegidoId) ?? null;
    if ((productoElegido.variantes ?? []).length > 0 && !tono) return;

    setLineas((previas) => {
      const tonoId = tono?.id ?? null;
      const existente = previas.find(
        (l) => l.productoId === productoElegido.id && l.tonoId === tonoId
      );
      if (existente) {
        return previas.map((l) =>
          l.productoId === productoElegido.id && l.tonoId === tonoId
            ? { ...l, cantidad: l.cantidad + cantidadNueva }
            : l
        );
      }
      return [
        ...previas,
        {
          productoId: productoElegido.id,
          tonoId,
          tonoNombre: tono?.nombre ?? null,
          cantidad: cantidadNueva,
        },
      ];
    });

    setProductoElegido(null);
    setTonoElegidoId("");
    setCantidadNueva(1);
    setBusqueda("");
  }

  function quitarLinea(productoId: string, tonoId: string | null) {
    setLineas((previas) =>
      previas.filter((l) => !(l.productoId === productoId && l.tonoId === tonoId))
    );
  }

  function cambiarCantidad(productoId: string, tonoId: string | null, cantidad: number) {
    setLineas((previas) =>
      cantidad < 1
        ? previas.filter((l) => !(l.productoId === productoId && l.tonoId === tonoId))
        : previas.map((l) =>
            l.productoId === productoId && l.tonoId === tonoId ? { ...l, cantidad } : l
          )
    );
  }

  const detallesManual = lineas
    .map((linea) => {
      const producto = productos.find((p) => p.id === linea.productoId);
      return producto ? { linea, producto } : null;
    })
    .filter((d): d is { linea: LineaManual; producto: Producto } => d !== null);

  // Mismo criterio que el carrito: los tonos de un producto suman para elegir
  // el escalón, así que el recibo manual cobra igual que la tienda.
  const lineasCalculoManual = detallesManual.map((d) => ({
    productoId: d.producto.id,
    escalones: d.producto.escalones,
    cantidad: d.linea.cantidad,
  }));

  const totalesManual = calcularTotales(lineasCalculoManual, reglas, umbralPorMayor);

  const lineasReciboManual: (LineaRecibo & { key: string })[] = detallesManual.map((d) => {
    const key = `${d.producto.id}-${d.linea.tonoId ?? "sin"}`;
    const unitarioCalculado = unitarioDeLinea(
      { productoId: d.producto.id, escalones: d.producto.escalones, cantidad: d.linea.cantidad },
      lineasCalculoManual,
      totalesManual.porMayor
    );
    const unitario = preciosManualOverride[key] ?? unitarioCalculado;
    return {
      referencia: d.producto.referencia,
      nombre: d.producto.nombre,
      tono: d.linea.tonoNombre,
      cantidad: d.linea.cantidad,
      precioUnitario: unitario,
      subtotal: unitario * d.linea.cantidad,
      key,
    };
  });

  const subtotalManualOverride = lineasReciboManual.reduce((acc, l) => acc + l.subtotal, 0);
  const totalManualOverride = subtotalManualOverride - totalesManual.descuento;

  const listoParaDescargar =
    modo === "pedido" ? pedido !== null : clienteNombre.trim() !== "" && lineas.length > 0;

  async function alDescargar() {
    if (!listoParaDescargar) return;
    setGenerando(true);
    try {
      if (modo === "pedido" && pedido) {
        const lineasPedidoRecibo = pedido.lineas.map(l => {
          const precio = preciosPedidoOverride[l.id] ?? l.precioUnitarioAplicado;
          return { ...l, precioUnitarioAplicado: precio, subtotal: precio * l.cantidad };
        });
        const subtotalPedido = lineasPedidoRecibo.reduce((acc, l) => acc + l.subtotal, 0);
        const descuentoFinal = descuentoPedidoOverride ?? pedido.descuento;
        const totalPedido = subtotalPedido - descuentoFinal;

        await descargarReciboPDF({
          numero: pedido.numeroPedido,
          fecha: new Date(pedido.creadoEn),
          clienteNombre: pedido.clienteNombre,
          clienteWhatsapp: pedido.clienteWhatsapp,
          clienteCiudad: pedido.clienteCiudad,
          lineas: lineasPedidoRecibo.map((l) => ({
            referencia: l.referencia,
            nombre: l.nombre,
            tono: l.tono,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitarioAplicado,
            subtotal: l.subtotal,
          })),
          subtotal: subtotalPedido,
          descuento: mostrarDescuentoPedido ? descuentoFinal : 0,
          porcentaje: mostrarDescuentoPedido && descuentoFinal === pedido.descuento ? pedido.porcentajeDescuento : 0,
          porMayor: pedido.porMayor,
          total: totalPedido,
          pagoMetodo,
          pagoNumero,
          pagoTitular,
        });
      } else {
        const descuentoFinal = descuentoManualOverride ?? totalesManual.descuento;
        const totalManualCalculado = subtotalManualOverride - descuentoFinal;

        await descargarReciboPDF({
          numero: numero.trim() || numeroSugerido(),
          fecha: new Date(),
          clienteNombre: clienteNombre.trim(),
          clienteWhatsapp: clienteWhatsapp.trim() || null,
          clienteCiudad: clienteCiudad.trim() || null,
          lineas: lineasReciboManual,
          subtotal: subtotalManualOverride,
          descuento: mostrarDescuentoManual ? descuentoFinal : 0,
          porcentaje: mostrarDescuentoManual && descuentoFinal === totalesManual.descuento ? totalesManual.porcentaje : 0,
          porMayor: totalesManual.porMayor,
          total: totalManualCalculado,
          pagoMetodo,
          pagoNumero,
          pagoTitular,
        });
      }
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div role="group" aria-label="Tipo de recibo" className="grid grid-cols-2 gap-2">
        {(["pedido", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => setModo(m)}
            className={`min-h-11 cursor-pointer rounded-md border text-[15px] font-semibold ${
              modo === m ? "border-tinta bg-tinta text-fondo" : "border-borde bg-fondo text-tinta hover:border-tinta"
            }`}
          >
            {m === "pedido" ? "Desde un pedido" : "Recibo manual"}
          </button>
        ))}
      </div>

      {modo === "pedido" ? (
        <div className={`space-y-4 ${TARJETA}`}>
          <label className="block">
            <span className={ETIQUETA}>Elige el pedido</span>
            <select
              value={pedidoId}
              onChange={(e) => {
                setPedidoId(e.target.value);
                setPreciosPedidoOverride({});
                setDescuentoPedidoOverride(null);
                setMostrarDescuentoPedido(true);
              }}
              className={CAMPO}
            >
              <option value="">Selecciona un pedido…</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numeroPedido} · {p.clienteNombre} · {pesos(p.total)}
                </option>
              ))}
            </select>
          </label>

          {pedido && (
            <div className="space-y-3 rounded-md bg-superficie p-4">
              <div>
                <p className="text-base font-semibold leading-6 text-tinta">{pedido.clienteNombre}</p>
                <p className="text-sm leading-5 text-tinta-suave">
                  {pedido.clienteCiudad} · {pedido.clienteWhatsapp}
                </p>
              </div>
              <ul className="divide-y divide-linea">
                {pedido.lineas.map((l) => {
                  const precio = preciosPedidoOverride[l.id] ?? l.precioUnitarioAplicado;
                  return (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm text-tinta">
                      <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                        {l.nombre}
                        {l.tono && <span className="font-semibold"> · {l.tono}</span>}{" "}
                        <span className="tabular-nums text-tinta-suave">× {l.cantidad}</span>
                      </span>
                      <span className="ml-auto flex items-end gap-2">
                        <label className="block">
                          <span className="block text-[13px] leading-[18px] text-tinta-suave">Precio unitario</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            aria-label={`Precio unitario de ${l.nombre}${l.tono ? `, ${l.tono}` : ""}`}
                            className={PRECIO}
                            value={precio}
                            onChange={(e) =>
                              setPreciosPedidoOverride({ ...preciosPedidoOverride, [l.id]: Number(e.target.value) })
                            }
                          />
                        </label>
                        <span className="flex min-h-11 min-w-20 items-center justify-end font-semibold tabular-nums">{pesos(precio * l.cantidad)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-linea pt-3">
                <label className={CASILLA}>
                  <input
                    type="checkbox"
                    className="size-5 accent-tinta"
                    checked={mostrarDescuentoPedido}
                    onChange={(e) => setMostrarDescuentoPedido(e.target.checked)}
                  />
                  Mostrar en el recibo
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
                  Descuento ($)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={PRECIO}
                    value={descuentoPedidoOverride ?? pedido.descuento}
                    onChange={(e) => setDescuentoPedidoOverride(e.target.value === "" ? null : Number(e.target.value))}
                  />
                </label>
              </div>
              <p className="flex items-baseline justify-between text-tinta">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-bold tabular-nums">
                  {pesos(
                    pedido.lineas.reduce(
                      (acc, l) => acc + (preciosPedidoOverride[l.id] ?? l.precioUnitarioAplicado) * l.cantidad,
                      0
                    ) - (descuentoPedidoOverride ?? pedido.descuento)
                  )}
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`grid gap-4 sm:grid-cols-2 ${TARJETA}`}>
            <label className="block sm:col-span-2">
              <span className={ETIQUETA}>Número del recibo</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className={CAMPO} />
            </label>
            <label className="block">
              <span className={ETIQUETA}>Cliente</span>
              <input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                autoComplete="off"
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className={ETIQUETA}>
                WhatsApp <span className="font-normal text-tinta-suave">(opcional)</span>
              </span>
              <input
                value={clienteWhatsapp}
                onChange={(e) => setClienteWhatsapp(e.target.value)}
                inputMode="tel"
                autoComplete="off"
                className={CAMPO}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={ETIQUETA}>
                Ciudad <span className="font-normal text-tinta-suave">(opcional)</span>
              </span>
              <input value={clienteCiudad} onChange={(e) => setClienteCiudad(e.target.value)} className={CAMPO} />
            </label>
          </div>

          <div className={`space-y-3 ${TARJETA}`}>
            <div className="relative">
              <label className="block">
                <span className={ETIQUETA}>Agregar producto</span>
                <span className="mt-1 block text-[13px] leading-[18px] text-tinta-suave">Busca por nombre o referencia</span>
                <input
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setProductoElegido(null);
                  }}
                  type="search"
                  autoComplete="off"
                  className={CAMPO}
                />
              </label>
              {sugerencias.length > 0 && !productoElegido && (
                <ul className="absolute z-10 mt-1 w-full rounded-md bg-fondo p-1 shadow-flotante ring-1 ring-linea">
                  {sugerencias.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setProductoElegido(p);
                          setBusqueda(`${p.referencia} — ${p.nombre}`);
                        }}
                        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 text-left text-[15px] text-tinta hover:bg-superficie"
                      >
                        <span className="truncate">
                          <span className="font-semibold text-tinta-suave">{p.referencia}</span> {p.nombre}
                        </span>
                        <span className="shrink-0 tabular-nums text-tinta-suave">
                          {pesos(precioUnitarioPara(p.escalones, 1))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {productoElegido && (
              <div className="flex flex-wrap items-end gap-3">
                {(productoElegido.variantes ?? []).length > 0 && (
                  <label className="block min-w-40 flex-1">
                    <span className={ETIQUETA}>{productoElegido.etiquetaVariante}</span>
                    <select value={tonoElegidoId} onChange={(e) => setTonoElegidoId(e.target.value)} className={CAMPO}>
                      <option value="">Elige…</option>
                      {(productoElegido.variantes ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block w-28">
                  <span className={ETIQUETA}>Cantidad</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={cantidadNueva}
                    onChange={(e) => setCantidadNueva(Math.max(1, Number(e.target.value)))}
                    className={CAMPO}
                  />
                </label>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={agregarLinea}
                  disabled={(productoElegido.variantes ?? []).length > 0 && !tonoElegidoId}
                >
                  <IconoMas tamano={20} /> Agregar
                </Boton>
              </div>
            )}
          </div>

          {detallesManual.length > 0 && (
            <div className={`space-y-3 ${TARJETA}`}>
              <ul className="divide-y divide-linea">
                {detallesManual.map((d, i) => {
                  const linea = lineasReciboManual[i];
                  const nombre = `${d.producto.nombre}${d.linea.tonoNombre ? `, ${d.linea.tonoNombre}` : ""}`;
                  return (
                    <li key={linea.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm text-tinta">
                      <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                        <span className="font-semibold text-tinta-suave">{d.producto.referencia}</span> {d.producto.nombre}
                        {d.linea.tonoNombre && <span className="font-semibold"> · {d.linea.tonoNombre}</span>}{" "}
                        <span className="tabular-nums text-tinta-suave">× {d.linea.cantidad}</span>
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`Precio unitario de ${nombre}`}
                          className={PRECIO}
                          value={linea.precioUnitario}
                          onChange={(e) =>
                            setPreciosManualOverride({ ...preciosManualOverride, [linea.key]: Number(e.target.value) })
                          }
                        />
                        <span className="min-w-20 text-right font-semibold tabular-nums">{pesos(linea.subtotal)}</span>
                        <button
                          type="button"
                          aria-label={`Quitar ${nombre}`}
                          onClick={() => cambiarCantidad(d.producto.id, d.linea.tonoId, 0)}
                          className="min-h-11 cursor-pointer rounded-md px-2 font-semibold text-tinta underline underline-offset-2 hover:bg-superficie"
                        >
                          Quitar
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-2 border-t border-linea pt-3 text-sm">
                <div className="flex justify-between text-tinta-suave">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-tinta">{pesos(subtotalManualOverride)}</span>
                </div>
                {totalesManual.porMayor && (
                  <div className="flex justify-between font-semibold text-ahorro">
                    <span>Precio por mayor (base)</span>
                    <span className="tabular-nums">−{pesos(totalesManual.subtotalNormal - totalesManual.subtotalBase)}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <label className={CASILLA}>
                    <input
                      type="checkbox"
                      className="size-5 accent-tinta"
                      checked={mostrarDescuentoManual}
                      onChange={(e) => setMostrarDescuentoManual(e.target.checked)}
                    />
                    Mostrar en el recibo
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-tinta">
                    Descuento ($)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={PRECIO}
                      value={descuentoManualOverride ?? totalesManual.descuento}
                      onChange={(e) => setDescuentoManualOverride(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </label>
                </div>
                <p className="flex items-baseline justify-between pt-1 text-tinta">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-xl font-bold tabular-nums">
                    {pesos(subtotalManualOverride - (descuentoManualOverride ?? totalesManual.descuento))}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <Boton ancho disabled={!listoParaDescargar} cargando={generando} onClick={alDescargar}>
        {generando ? "Generando PDF…" : "Descargar recibo en PDF"}
      </Boton>
    </div>
  );
}
