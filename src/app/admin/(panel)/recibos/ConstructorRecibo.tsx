"use client";

import { useMemo, useState } from "react";
import { precioUnitarioPara } from "@/lib/pricing";
import { calcularTotales, unitarioDeLinea, type ReglaDescuento } from "@/lib/discounts";
import { pesos } from "@/lib/format";
import { descargarReciboPDF, type LineaRecibo } from "@/lib/pdf/recibo";
import { Boton } from "@/components/ui/Boton";
import { IconoMas } from "@/components/ui/Iconos";
import type { Pedido, Producto } from "@/lib/types";

const CAMPO =
  "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 " +
  "outline-none transition duration-200 focus:border-fucsia";

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
  productos,
  reglas,
  umbralPorMayor,
  pagoMetodo,
  pagoNumero,
  pagoTitular,
}: {
  pedidos: Pedido[];
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
  const [pedidoId, setPedidoId] = useState("");
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
    const tono = productoElegido.tonos.find((t) => t.id === tonoElegidoId) ?? null;
    if (productoElegido.tonos.length > 0 && !tono) return;

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

  const lineasReciboManual: LineaRecibo[] = detallesManual.map((d) => {
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
    } as LineaRecibo & { key: string };
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
      <div className="flex gap-2">
        <button
          onClick={() => setModo("pedido")}
          className={`min-h-[44px] flex-1 cursor-pointer rounded-pastilla text-sm font-semibold
            transition duration-200 ${
              modo === "pedido" ? "bg-fucsia text-petalo" : "bg-petalo text-carbon-suave"
            }`}
        >
          Desde un pedido
        </button>
        <button
          onClick={() => setModo("manual")}
          className={`min-h-[44px] flex-1 cursor-pointer rounded-pastilla text-sm font-semibold
            transition duration-200 ${
              modo === "manual" ? "bg-fucsia text-petalo" : "bg-petalo text-carbon-suave"
            }`}
        >
          Recibo manual
        </button>
      </div>

      {modo === "pedido" ? (
        <div className="space-y-3 rounded-tarjeta bg-petalo p-5 shadow-petalo">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-carbon">
              Elige el pedido
            </span>
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
            <div className="space-y-2 rounded-suave bg-rosa-nube p-4">
              <p className="text-sm font-semibold text-carbon">{pedido.clienteNombre}</p>
              <p className="text-xs text-carbon-suave">
                {pedido.clienteCiudad} · {pedido.clienteWhatsapp}
              </p>
              <ul className="space-y-1 pt-1">
                {pedido.lineas.map((l) => {
                  const precio = preciosPedidoOverride[l.id] ?? l.precioUnitarioAplicado;
                  const subtotal = precio * l.cantidad;
                  return (
                    <li key={l.id} className="flex justify-between items-center text-xs text-carbon">
                      <span>
                        {l.nombre}
                        {l.tono && <strong className="text-fucsia"> · {l.tono}</strong>} x
                        {l.cantidad}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-carbon-suave text-xs">P.U. $</span>
                        <input
                          type="number"
                          className="w-20 rounded border border-rosa-nube px-1 py-0.5 text-right font-semibold bg-white"
                          value={precio}
                          onChange={(e) => setPreciosPedidoOverride({...preciosPedidoOverride, [l.id]: Number(e.target.value)})}
                        />
                        <span className="font-semibold ml-2 min-w-[60px] text-right">{pesos(subtotal)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="pt-2 text-right">
                <div className="flex justify-end items-center gap-3 mb-2 mt-1">
                  <label className="flex items-center gap-1 text-xs text-carbon-suave cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={mostrarDescuentoPedido} 
                      onChange={(e) => setMostrarDescuentoPedido(e.target.checked)} 
                    />
                    Mostrar en recibo
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-lila font-semibold">Descuento $</span>
                    <input
                      type="number"
                      className="w-24 rounded border border-rosa-nube px-2 py-1 text-right font-semibold bg-white text-sm"
                      value={descuentoPedidoOverride ?? pedido.descuento}
                      onChange={(e) => setDescuentoPedidoOverride(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </div>
                </div>
                <p className="font-display text-lg text-fucsia">
                  {pesos(
                    pedido.lineas.reduce(
                      (acc, l) => acc + (preciosPedidoOverride[l.id] ?? l.precioUnitarioAplicado) * l.cantidad,
                      0
                    ) - (descuentoPedidoOverride ?? pedido.descuento)
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-tarjeta bg-petalo p-5 shadow-petalo sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-carbon">
                Número o referencia del recibo
              </span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className={CAMPO}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-carbon">
                Cliente
              </span>
              <input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre completo"
                className={CAMPO}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-carbon">
                WhatsApp <span className="font-normal text-carbon-suave">(opcional)</span>
              </span>
              <input
                value={clienteWhatsapp}
                onChange={(e) => setClienteWhatsapp(e.target.value)}
                className={CAMPO}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-carbon">
                Ciudad <span className="font-normal text-carbon-suave">(opcional)</span>
              </span>
              <input
                value={clienteCiudad}
                onChange={(e) => setClienteCiudad(e.target.value)}
                className={CAMPO}
              />
            </label>
          </div>

          {/* Agregar productos */}
          <div className="space-y-3 rounded-tarjeta bg-petalo p-5 shadow-petalo">
            <p className="text-sm font-semibold text-carbon">Agregar producto</p>

            <div className="relative">
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setProductoElegido(null);
                }}
                placeholder="Busca por nombre o referencia…"
                className={CAMPO}
              />
              {sugerencias.length > 0 && !productoElegido && (
                <ul className="absolute z-10 mt-1 w-full space-y-0.5 rounded-suave bg-petalo p-1 shadow-flotante">
                  {sugerencias.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setProductoElegido(p);
                          setBusqueda(`${p.referencia} — ${p.nombre}`);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between
                                   rounded-suave px-3 py-2 text-left text-sm hover:bg-rosa-nube"
                      >
                        <span className="truncate">
                          <span className="font-bold text-lila">{p.referencia}</span>{" "}
                          {p.nombre}
                        </span>
                        <span className="shrink-0 text-carbon-suave">
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
                {productoElegido.tonos.length > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-carbon">Tono</span>
                    <select
                      value={tonoElegidoId}
                      onChange={(e) => setTonoElegidoId(e.target.value)}
                      className="min-h-[44px] rounded-suave border-2 border-lila-suave bg-petalo px-3"
                    >
                      <option value="">Elige…</option>
                      {productoElegido.tonos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-carbon">Cantidad</span>
                  <input
                    type="number"
                    min={1}
                    value={cantidadNueva}
                    onChange={(e) => setCantidadNueva(Math.max(1, Number(e.target.value)))}
                    className="min-h-[44px] w-24 rounded-suave border-2 border-lila-suave bg-petalo px-3"
                  />
                </label>

                <Boton
                  type="button"
                  onClick={agregarLinea}
                  disabled={productoElegido.tonos.length > 0 && !tonoElegidoId}
                >
                  <IconoMas className="h-4 w-4" /> Agregar
                </Boton>
              </div>
            )}
          </div>

          {/* Líneas agregadas */}
          {detallesManual.length > 0 && (
            <div className="space-y-3 rounded-tarjeta bg-petalo p-5 shadow-petalo">
              <ul className="space-y-2">
                {detallesManual.map((d, i) => {
                  const key = `${d.producto.id}-${d.linea.tonoId ?? "sin"}`;
                  const lineaRecibo = lineasReciboManual.find(l => (l as any).key === key);
                  if (!lineaRecibo) return null;
                  return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-lila">{d.producto.referencia}</span>{" "}
                      {d.producto.nombre}
                      {d.linea.tonoNombre && (
                        <strong className="text-fucsia"> · {d.linea.tonoNombre}</strong>
                      )}{" "}
                      x{d.linea.cantidad}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-carbon-suave text-xs">P.U. $</span>
                      <input
                        type="number"
                        className="w-20 rounded border border-rosa-nube px-1 py-0.5 text-right font-semibold bg-white"
                        value={lineaRecibo.precioUnitario}
                        onChange={(e) => setPreciosManualOverride({...preciosManualOverride, [key]: Number(e.target.value)})}
                      />
                      <span className="font-semibold text-carbon min-w-[60px] text-right">
                        {pesos(lineaRecibo.subtotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          cambiarCantidad(d.producto.id, d.linea.tonoId, 0)
                        }
                        className="shrink-0 cursor-pointer text-xs text-carbon-suave underline hover:text-fucsia ml-1"
                      >
                        quitar
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>

              <div className="space-y-1 border-t border-rosa-nube pt-3">
                <div className="flex justify-between text-sm text-carbon-suave items-center">
                  <span>Subtotal</span>
                  <span>{pesos(subtotalManualOverride)}</span>
                </div>
                {totalesManual.porMayor && (
                  <div className="flex justify-between text-sm font-semibold text-lila items-center">
                    <span>Precio por mayor (base)</span>
                    <span>
                      −{pesos(totalesManual.subtotalNormal - totalesManual.subtotalBase)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm font-semibold text-lila items-center">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-carbon-suave cursor-pointer select-none font-normal">
                      <input 
                        type="checkbox" 
                        checked={mostrarDescuentoManual} 
                        onChange={(e) => setMostrarDescuentoManual(e.target.checked)} 
                      />
                      Mostrar en recibo
                    </label>
                    <span>Descuento $</span>
                  </div>
                  <input
                    type="number"
                    className="w-24 rounded border border-rosa-nube px-2 py-0.5 text-right font-semibold bg-white text-sm text-carbon"
                    value={descuentoManualOverride ?? totalesManual.descuento}
                    onChange={(e) => setDescuentoManualOverride(e.target.value === "" ? null : Number(e.target.value))}
                  />
                </div>

                <div className="flex justify-between pt-1 font-display text-lg text-carbon items-center">
                  <span>Total</span>
                  <span className="text-fucsia">
                    {pesos(subtotalManualOverride - (descuentoManualOverride ?? totalesManual.descuento))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Boton ancho disabled={!listoParaDescargar || generando} onClick={alDescargar}>
        {generando ? "Generando PDF…" : "Descargar recibo en PDF"}
      </Boton>
    </div>
  );
}
