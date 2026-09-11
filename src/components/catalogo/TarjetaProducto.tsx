"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useState } from "react";
import dynamic from "next/dynamic";
import { precioUnitarioPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito, usarLineasDeProducto, usarUnidadesDeProducto } from "@/lib/cart";
import {
  IconoCorazon,
  IconoMas,
  IconoMenos,
  IconoLupa,
  IconoPaleta,
  IconoLapiz,
} from "@/components/ui/Iconos";
import type { Producto } from "@/lib/types";

/**
 * La hoja de tonos y el visor de imagen se descargan al abrirlos, no al
 * cargar el catálogo. Entre los dos arrastran el selector de tonos, el
 * agrupador de colores y el visor a pantalla completa: código que la
 * mayoría de visitas nunca llega a usar y que, multiplicado por una
 * grilla entera, retrasaba el primer toque útil.
 */
const VisorImagen = dynamic(() =>
  import("@/components/ui/VisorImagen").then((m) => m.VisorImagen)
);
const HojaCompra = dynamic(() =>
  import("@/components/producto/HojaCompra").then((m) => m.HojaCompra)
);

/**
 * Tarjeta del catálogo.
 *
 * DOS PROBLEMAS QUE ESTA VERSIÓN ARREGLA
 *
 * 1. "Se traba." La tarjeta se suscribía al carrito ENTERO
 *    (`usarCarrito((e) => e.lineas)`). Con 591 tarjetas en pantalla,
 *    tocar un "+" cambiaba la lista y React re-renderizaba las 591 — con
 *    sus imágenes, sus paletas y sus cálculos de precio. Ahora usa
 *    `usarLineasDeProducto`, que solo cambia si cambia ESTE producto, y
 *    va envuelta en `memo`.
 *
 * 2. "Los tonos son muchísimos y me obligan a verlos." Los círculos de
 *    color ya no viven aquí. La tarjeta solo dice cuántos tonos hay; la
 *    paleta aparece en la hoja de compra, y solo si la clienta la pide.
 *    Eso quita el muro de colores de productos que no le interesan y, de
 *    paso, saca decenas de miles de filas de la consulta del catálogo.
 *
 * El precio que se pinta es el que se está cobrando ahora mismo:
 * `precioUnitarioPara(escalones, max(1, unidadesEnLaBolsa))`. Nunca el
 * más barato del combo: mostrar ése confundía porque no coincidía con el
 * cobro real.
 */
function TarjetaProductoBase({ producto }: { producto: Producto }) {
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  const agregar = usarCarrito((e) => e.agregar);
  const establecer = usarCarrito((e) => e.establecer);

  // Suscripciones finas: esta tarjeta solo se entera de lo suyo.
  const lineas = usarLineasDeProducto(producto.id);
  const yaEnBolsa = usarUnidadesDeProducto(producto.id);

  const sinStock = producto.stock === 0;
  const sinPrecio = producto.escalones.length === 0;
  const tieneCombo = producto.escalones.length > 1;
  const necesitaTono = producto.numTonos > 0;
  const puedeSumar = yaEnBolsa < producto.stock;

  const unitarioActual = sinPrecio
    ? null
    : precioUnitarioPara(producto.escalones, Math.max(1, yaEnBolsa));

  const upsell =
    !sinPrecio && yaEnBolsa > 0
      ? sugerenciaUpsell(producto.escalones, yaEnBolsa)
      : null;
  const upsellAlcanzable = upsell !== null && upsell.nuevaCantidad <= producto.stock;

  // Sin tonos hay una sola línea posible: se puede sumar desde la tarjeta.
  const lineaUnica = !necesitaTono ? (lineas[0] ?? null) : null;

  function sumarDirecto() {
    if (!puedeSumar) return;
    agregar(producto.id, 1, null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }

  const botonRedondo =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full " +
    "transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <>
      <article className="flex flex-col overflow-hidden rounded-tarjeta bg-petalo shadow-petalo">
        {/* Imagen: abre el visor en alta resolución */}
        <button
          type="button"
          onClick={() => producto.imagenPrincipal && setVisorAbierto(true)}
          disabled={!producto.imagenPrincipal}
          aria-label={`Ver la foto de ${producto.nombre} en grande`}
          className="group relative aspect-square cursor-pointer bg-rosa-nube"
        >
          {producto.imagenPrincipal ? (
            <>
              <Image
                src={producto.imagenPrincipal}
                alt={producto.nombre}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <span
                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center
                           rounded-full bg-petalo/90 text-carbon shadow-petalo"
                aria-hidden="true"
              >
                <IconoLupa className="h-5 w-5" />
              </span>
            </>
          ) : (
            <span className="flex h-full items-center justify-center text-lila-suave">
              <IconoCorazon className="h-12 w-12" />
            </span>
          )}

          <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {tieneCombo && !sinStock && (
              <span className="rounded-pastilla bg-lila-texto px-2.5 py-1 text-xs font-bold text-petalo">
                Combo
              </span>
            )}
            {yaEnBolsa > 0 && (
              <span className="rounded-pastilla bg-fucsia px-2.5 py-1 text-xs font-bold text-petalo">
                {yaEnBolsa} en tu bolsa
              </span>
            )}
          </span>

          {sinStock && (
            <span className="absolute inset-0 flex items-center justify-center bg-petalo/85">
              <span className="font-display text-xl text-carbon-suave">Agotado</span>
            </span>
          )}
        </button>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-lila-texto">
              {producto.referencia}
            </p>

            <Link
              // Codificada: hay referencias con "/" y espacios
              // (ACRYLIC80/150, A05 ESPEJO) y sin escapar el "/" la ruta
              // se parte en dos y da 404.
              href={`/producto/${encodeURIComponent(producto.referencia)}`}
              className="line-clamp-2 text-[15px] font-semibold leading-snug text-carbon
                         transition hover:text-fucsia-texto"
            >
              {producto.nombre}
            </Link>
          </div>

          {unitarioActual !== null ? (
            <p className="text-lg font-bold text-fucsia-texto">
              {pesos(unitarioActual)}
              <span className="text-xs font-normal text-carbon-suave"> c/u</span>
            </p>
          ) : (
            <p className="text-sm text-carbon-suave">Precio por confirmar</p>
          )}

          {!sinStock && producto.stock <= 5 && (
            <p className="text-sm font-semibold text-alerta">
              Quedan {producto.stock}
            </p>
          )}

          {!sinStock && !sinPrecio && (
            <div className="mt-auto space-y-2 pt-1">
              {necesitaTono ? (
                /* Con tonos: la paleta vive en la hoja, no aquí. Un solo
                   botón claro en vez de un muro de círculos. */
                <button
                  onClick={() => setHojaAbierta(true)}
                  className="flex min-h-[48px] w-full cursor-pointer items-center
                             justify-center gap-2 rounded-pastilla bg-fucsia px-3
                             text-[15px] font-semibold text-petalo transition
                             duration-200 hover:brightness-110"
                >
                  {yaEnBolsa > 0 ? (
                    <>
                      <IconoLapiz className="h-5 w-5" /> Cambiar
                    </>
                  ) : (
                    <>
                      <IconoPaleta className="h-5 w-5" /> Elegir tono
                    </>
                  )}
                </button>
              ) : lineaUnica ? (
                /* Sin tonos: sumar y restar desde la tarjeta, que es el
                   camino más corto durante un live. */
                <div className="flex items-center justify-between gap-2">
                  <button
                    aria-label={`Quitar uno de ${producto.nombre}`}
                    onClick={() =>
                      establecer(producto.id, null, lineaUnica.cantidad - 1)
                    }
                    className={`${botonRedondo} border-2 border-fucsia-suave text-fucsia-texto`}
                  >
                    <IconoMenos className="h-5 w-5" />
                  </button>

                  <span
                    aria-live="polite"
                    className="font-display text-2xl text-carbon"
                  >
                    {lineaUnica.cantidad}
                  </span>

                  <button
                    aria-label={`Agregar uno de ${producto.nombre}`}
                    onClick={sumarDirecto}
                    disabled={!puedeSumar}
                    className={`${botonRedondo} bg-fucsia text-petalo`}
                  >
                    <IconoMas className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={sumarDirecto}
                  disabled={!puedeSumar}
                  className="flex min-h-[48px] w-full cursor-pointer items-center
                             justify-center gap-1 rounded-pastilla bg-fucsia px-3
                             text-[15px] font-semibold text-petalo transition
                             duration-200 hover:brightness-110 disabled:opacity-40"
                >
                  <IconoMas className="h-5 w-5" /> Agregar
                </button>
              )}

              {yaEnBolsa > 0 && unitarioActual !== null && (
                <p className="text-center text-[15px] font-bold text-fucsia-texto">
                  {pesos(unitarioActual * yaEnBolsa)}
                  <span className="font-normal text-carbon-suave"> en total</span>
                </p>
              )}

              {upsellAlcanzable && (
                <p className="rounded-suave bg-lila-suave/40 px-2 py-1.5 text-center
                              text-xs leading-tight text-lila-texto">
                  ✨ Suma {upsell.unidadesFaltantes} y ahorras{" "}
                  <strong>{pesos(upsell.ahorro)}</strong>
                </p>
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

      {hojaAbierta && (
        <HojaCompra producto={producto} alCerrar={() => setHojaAbierta(false)} />
      )}
    </>
  );
}

/**
 * `memo` es lo que remata el arreglo de rendimiento: aunque la lista
 * vuelva a renderizarse (al cargar otra tanda, por ejemplo), las tarjetas
 * cuyo `producto` no cambió no hacen nada.
 */
export const TarjetaProducto = memo(TarjetaProductoBase);
