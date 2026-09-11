"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { SelectorTonos } from "./SelectorTonos";
import { SelectorCantidad } from "./SelectorCantidad";
import { Boton } from "@/components/ui/Boton";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { IconoBolsa, IconoCorazon, IconoBasura } from "@/components/ui/Iconos";
import { precioUnitarioPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito, usarLineasDeProducto, usarUnidadesDeProducto } from "@/lib/cart";
import { cargarTonos } from "@/app/acciones-catalogo";
import type { Producto, Tono } from "@/lib/types";

/**
 * Hoja de compra: elegir tono, elegir cantidad y agregar, sin salir del
 * catálogo.
 *
 * Reemplaza el muro de círculos que vivía dentro de cada tarjeta. Los
 * tonos se piden aquí, al abrirla, no al cargar el catálogo: la clienta
 * solo descarga la paleta del producto que de verdad le interesa.
 */
export function HojaCompra({
  producto,
  alCerrar,
}: {
  producto: Producto;
  alCerrar: () => void;
}) {
  const necesitaTono = producto.numTonos > 0;

  // Si el producto ya trae los tonos (pantalla de detalle) no se vuelven
  // a pedir; si viene de la grilla, llegan vacíos y se cargan aquí.
  const [tonos, setTonos] = useState<Tono[]>(producto.tonos);
  const [cargandoTonos, setCargandoTonos] = useState(
    necesitaTono && producto.tonos.length === 0
  );
  const [fallo, setFallo] = useState(false);

  const [tono, setTono] = useState<Tono | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const agregar = usarCarrito((e) => e.agregar);
  const establecer = usarCarrito((e) => e.establecer);
  const lineas = usarLineasDeProducto(producto.id);
  const yaEnBolsa = usarUnidadesDeProducto(producto.id);

  useEffect(() => {
    if (!cargandoTonos) return;

    let vigente = true;
    cargarTonos(producto.id)
      .then((t) => {
        if (!vigente) return;
        setTonos(t);
        // Un solo tono no es una elección: se da por elegido y la clienta
        // se ahorra un toque.
        if (t.length === 1) setTono(t[0]);
      })
      .catch(() => vigente && setFallo(true))
      .finally(() => vigente && setCargandoTonos(false));

    return () => {
      vigente = false;
    };
  }, [producto.id, cargandoTonos]);

  useEffect(() => {
    if (!cargandoTonos && tonos.length === 1 && !tono) setTono(tonos[0]);
  }, [cargandoTonos, tonos, tono]);

  const disponible = Math.max(0, producto.stock - yaEnBolsa);
  const sinEscalones = producto.escalones.length === 0;

  // Los tonos comparten escalón: lo que ya está en la bolsa cuenta para
  // el precio de lo que se va a agregar ahora.
  const cantidadResultante = yaEnBolsa + cantidad;
  const unitario = sinEscalones
    ? 0
    : precioUnitarioPara(producto.escalones, Math.max(1, cantidadResultante));
  const unitarioEnBolsa = sinEscalones
    ? 0
    : precioUnitarioPara(producto.escalones, Math.max(1, yaEnBolsa));

  const upsell = sinEscalones
    ? null
    : sugerenciaUpsell(producto.escalones, cantidadResultante);
  const upsellAlcanzable = upsell !== null && upsell.nuevaCantidad <= producto.stock;

  const puedeAgregar =
    !sinEscalones && disponible > 0 && (!necesitaTono || tono !== null);

  function alAgregar() {
    if (!puedeAgregar) return;
    agregar(producto.id, Math.min(cantidad, disponible), tono);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(12);
    }
    alCerrar();
  }

  return (
    <Hoja
      titulo={producto.nombre}
      descripcion={
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="font-bold text-lila-texto">{producto.referencia}</span>
          {!sinEscalones && (
            <span>
              {pesos(unitario)} c/u
              {producto.escalones.length > 1 && " · mejor precio al llevar más"}
            </span>
          )}
        </span>
      }
      alCerrar={alCerrar}
      pie={
        <div className="space-y-2">
          {upsellAlcanzable && (
            <p className="rounded-suave bg-lila-suave/40 px-3 py-2 text-center text-sm text-lila-texto">
              ✨ Suma {upsell.unidadesFaltantes} más y te salen a{" "}
              <strong>{pesos(upsell.nuevoPrecioUnitario)}</strong> c/u
            </p>
          )}

          <Boton
            ancho
            tamano="grande"
            onClick={alAgregar}
            disabled={!puedeAgregar}
          >
            {sinEscalones ? (
              "Sin precio por ahora"
            ) : disponible === 0 ? (
              "Ya llevas todo lo que queda"
            ) : necesitaTono && !tono ? (
              "Elige un tono para continuar"
            ) : (
              <>
                <IconoBolsa /> Agregar · {pesos(unitario * cantidad)}
              </>
            )}
          </Boton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
            {producto.imagenPrincipal ? (
              <Image
                src={producto.imagenPrincipal}
                alt={producto.nombre}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-lila-suave">
                <IconoCorazon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1 text-sm">
            {producto.stock <= 5 && producto.stock > 0 && (
              <p className="font-semibold text-alerta">
                Quedan solo {producto.stock}
              </p>
            )}
            {producto.descripcion && (
              <p className="line-clamp-4 text-carbon-suave">{producto.descripcion}</p>
            )}
          </div>
        </div>

        {/* ---- Tonos ---- */}
        {necesitaTono && (
          <section className="space-y-2">
            <h3 id="titulo-tonos" className="text-base font-bold text-carbon">
              Elige tu tono
              <span className="pl-1 font-normal text-carbon-suave">
                ({producto.numTonos})
              </span>
            </h3>

            {cargandoTonos ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Cargando tonos">
                {Array.from({ length: 8 }, (_, i) => (
                  <Esqueleto key={i} className="h-[86px]" />
                ))}
              </div>
            ) : fallo ? (
              <div className="space-y-3 rounded-suave bg-rosa-nube p-4 text-center">
                <p className="text-carbon-suave">
                  No pudimos cargar los tonos de este producto.
                </p>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setFallo(false);
                    setCargandoTonos(true);
                  }}
                >
                  Reintentar
                </Boton>
              </div>
            ) : (
              <SelectorTonos
                tonos={tonos}
                elegido={tono}
                alElegir={setTono}
                idEtiqueta="titulo-tonos"
              />
            )}
          </section>
        )}

        {/* ---- Cantidad ---- */}
        {!sinEscalones && disponible > 0 && (
          <section className="space-y-2">
            <h3 className="text-base font-bold text-carbon">¿Cuántas llevas?</h3>
            <SelectorCantidad
              valor={cantidad}
              cantidadMaxima={Math.max(1, disponible)}
              alCambiar={setCantidad}
            />
            {producto.escalones.length > 1 && (
              <ul className="space-y-1 rounded-suave bg-rosa-nube p-3">
                {producto.escalones.map((e) => {
                  const activo =
                    e.minCantidad ===
                    producto.escalones.reduce(
                      (mejor, x) =>
                        x.minCantidad <= cantidadResultante ? x.minCantidad : mejor,
                      producto.escalones[0].minCantidad
                    );
                  return (
                    <li
                      key={e.minCantidad}
                      className={`flex justify-between rounded-suave px-2 py-1.5 text-sm ${
                        activo ? "bg-fucsia/10 font-bold text-fucsia-texto" : "text-carbon-suave"
                      }`}
                    >
                      <span>
                        {e.minCantidad === 1 ? "1 unidad" : `${e.minCantidad} o más`}
                      </span>
                      <span>{pesos(e.precioUnitario)} c/u</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ---- Lo que ya lleva de este producto ---- */}
        {lineas.length > 0 && (
          <section className="space-y-2 rounded-suave bg-rosa-nube p-3">
            <h3 className="text-sm font-bold text-carbon">
              Ya llevas de este producto
            </h3>
            <ul className="space-y-1.5">
              {lineas.map((l) => (
                <li
                  key={l.tonoId ?? "sin-tono"}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-carbon">
                    {l.tonoNombre ?? "Sin tono"} · x{l.cantidad}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-fucsia-texto">
                    {pesos(unitarioEnBolsa * l.cantidad)}
                  </span>
                  <button
                    type="button"
                    onClick={() => establecer(producto.id, l.tonoId, 0)}
                    aria-label={`Quitar ${l.tonoNombre ?? producto.nombre} de la bolsa`}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center
                               justify-center rounded-full text-carbon-suave transition
                               hover:bg-petalo hover:text-fucsia-texto"
                  >
                    <IconoBasura className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Hoja>
  );
}
