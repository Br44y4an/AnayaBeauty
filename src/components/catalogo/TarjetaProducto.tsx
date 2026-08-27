"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { precioUnitarioPara, subtotalPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito, unidadesDeProducto } from "@/lib/cart";
import { Insignia } from "@/components/ui/Insignia";
import { VisorImagen } from "@/components/ui/VisorImagen";
import { SelectorTonos } from "@/components/producto/SelectorTonos";
import { IconoCorazon, IconoMas, IconoMenos, IconoLupa } from "@/components/ui/Iconos";
import type { Producto, Tono } from "@/lib/types";

/**
 * Tarjeta del catálogo con compra directa.
 *
 * Durante un live, entrar al detalle por cada producto es demasiada
 * fricción: los controles de cantidad viven aquí. El nombre sigue llevando
 * al detalle para quien quiera leer la descripción.
 */
export function TarjetaProducto({ producto }: { producto: Producto }) {
  const [tono, setTono] = useState<Tono | null>(null);
  const [visorAbierto, setVisorAbierto] = useState(false);

  const lineas = usarCarrito((e) => e.lineas);
  const agregar = usarCarrito((e) => e.agregar);
  const establecer = usarCarrito((e) => e.establecer);

  const sinStock = producto.stock === 0;
  const quedaPoco = producto.stock > 0 && producto.stock <= 5;
  const tieneCombo = producto.escalones.length > 1;
  const necesitaTono = producto.tonos.length > 0;
  // Precio de 1 unidad: es el que se cobra al tocar "Agregar" la primera vez,
  // así que es el único que tiene sentido pintar en la tarjeta (mostrar el
  // precio más bajo del combo confundía, porque no era lo que se cobraba).
  const precioUnidad = producto.escalones.length
    ? precioUnitarioPara(producto.escalones, 1)
    : null;

  // Los tonos comparten inventario: cuenta todo lo del producto en la bolsa
  const yaEnBolsa = unidadesDeProducto(lineas, producto.id);
  const lineasDeEsteProducto = lineas.filter((l) => l.productoId === producto.id);
  const tonoId = tono?.id ?? null;
  const enEstaLinea =
    lineas.find((l) => l.productoId === producto.id && l.tonoId === tonoId)?.cantidad ?? 0;
  const puedeSumar = yaEnBolsa < producto.stock;

  const upsell =
    enEstaLinea > 0 ? sugerenciaUpsell(producto.escalones, enEstaLinea) : null;
  const upsellAlcanzable =
    upsell !== null && upsell.nuevaCantidad <= producto.stock - (yaEnBolsa - enEstaLinea);

  function sumar() {
    if (!puedeSumar) return;
    agregar(producto.id, 1, tono);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }

  const botonRedondo =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full " +
    "transition duration-200 focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-fucsia disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <>
      <article
        className="flex flex-col overflow-hidden rounded-tarjeta bg-petalo shadow-petalo
                   transition duration-200 hover:shadow-flotante"
      >
        {/* Imagen: abre el visor en alta resolución */}
        <button
          type="button"
          onClick={() => producto.imagenPrincipal && setVisorAbierto(true)}
          disabled={!producto.imagenPrincipal}
          aria-label={`Ver ${producto.nombre} en grande`}
          className="group relative aspect-square cursor-pointer bg-rosa-nube
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia"
        >
          {producto.imagenPrincipal ? (
            <>
              <Image
                src={producto.imagenPrincipal}
                alt={producto.nombre}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <span
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center
                           rounded-full bg-petalo/90 text-carbon shadow-petalo"
              >
                <IconoLupa className="h-4 w-4" />
              </span>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-lila-suave">
              <IconoCorazon className="h-10 w-10" />
            </div>
          )}

          {tieneCombo && !sinStock && (
            <span
              className="absolute left-2 top-2 rounded-pastilla bg-lila px-2.5 py-1
                         text-[10px] font-bold uppercase tracking-wide text-petalo"
            >
              Combo
            </span>
          )}

          {sinStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-petalo/80">
              <span className="font-display text-lg text-carbon-suave">Agotado</span>
            </div>
          )}
        </button>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-lila">
              {producto.referencia}
            </p>

            <Link
              href={`/producto/${producto.referencia}`}
              className="line-clamp-2 text-sm font-semibold leading-snug text-carbon
                         transition hover:text-fucsia focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-fucsia"
            >
              {producto.nombre}
            </Link>
          </div>

          {precioUnidad !== null && (
            <p className="text-base font-bold text-fucsia">
              {pesos(precioUnidad)}
              <span className="text-[11px] font-normal text-carbon-suave"> c/u</span>
            </p>
          )}

          {quedaPoco && <Insignia tono="alerta">Quedan {producto.stock}</Insignia>}

          {!sinStock && producto.escalones.length > 0 && (
            <div className="mt-auto space-y-2 pt-1">
              {necesitaTono && (
                <SelectorTonos
                  tonos={producto.tonos}
                  elegido={tono}
                  alElegir={setTono}
                  compacto
                />
              )}

              {necesitaTono && !tono ? (
                <p className="rounded-pastilla bg-rosa-nube py-2 text-center text-[11px]
                              font-semibold text-carbon-suave">
                  Elige un tono para agregar
                </p>
              ) : enEstaLinea === 0 ? (
                <button
                  onClick={sumar}
                  disabled={!puedeSumar}
                  className="flex min-h-[40px] w-full cursor-pointer items-center justify-center
                             gap-1 rounded-pastilla bg-fucsia text-sm font-semibold text-petalo
                             transition duration-200 hover:brightness-110
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-fucsia disabled:opacity-40"
                >
                  <IconoMas className="h-4 w-4" /> Agregar
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      aria-label={`Quitar uno de ${producto.nombre}`}
                      onClick={() => establecer(producto.id, tonoId, enEstaLinea - 1)}
                      className={`${botonRedondo} border-2 border-fucsia-suave text-fucsia`}
                    >
                      <IconoMenos className="h-4 w-4" />
                    </button>

                    <span className="font-display text-xl text-carbon">{enEstaLinea}</span>

                    <button
                      aria-label={`Agregar uno de ${producto.nombre}`}
                      onClick={sumar}
                      disabled={!puedeSumar}
                      className={`${botonRedondo} bg-fucsia text-petalo`}
                    >
                      <IconoMas className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-center text-sm font-bold text-fucsia">
                    {pesos(subtotalPara(producto.escalones, enEstaLinea))}
                  </p>

                  {upsellAlcanzable && (
                    <p className="rounded-suave bg-lila-suave/40 px-2 py-1 text-center
                                  text-[11px] leading-tight text-lila">
                      ✨ Suma {upsell.unidadesFaltantes} y ahorras{" "}
                      <strong>{pesos(upsell.ahorro)}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Al cambiar de tono se pierde de vista lo ya agregado en los
                  otros tonos de este mismo producto: este resumen lo deja
                  siempre visible, cada tono con su propia cantidad. */}
              {necesitaTono && lineasDeEsteProducto.length > 0 && (
                <ul className="space-y-1 rounded-suave bg-rosa-nube px-2 py-1.5">
                  {lineasDeEsteProducto.map((l) => (
                    <li
                      key={l.tonoId ?? "sin-tono"}
                      className="flex items-center justify-between gap-2 text-[11px] text-carbon"
                    >
                      <span className="truncate">
                        {l.tonoNombre ?? "Sin tono"} · x{l.cantidad}
                      </span>
                      <span className="shrink-0 font-semibold text-fucsia">
                        {pesos(subtotalPara(producto.escalones, l.cantidad))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </article>

      {visorAbierto && producto.imagenPrincipal && (
        <VisorImagen
          src={producto.imagenPrincipal}
          alt={producto.nombre}
          alCerrar={() => setVisorAbierto(false)}
        />
      )}
    </>
  );
}
