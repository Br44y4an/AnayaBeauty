"use client";

import { useState } from "react";
import { precioUnitarioPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito, usarLineasDeProducto, usarUnidadesDeProducto } from "@/lib/cart";
import { Boton } from "@/components/ui/Boton";
import { IconoBolsa, IconoCheck, IconoBasura } from "@/components/ui/Iconos";
import { SelectorCantidad } from "./SelectorCantidad";
import { SelectorTonos } from "./SelectorTonos";
import { TablaEscalones } from "./TablaEscalones";
import type { Producto, Tono } from "@/lib/types";

/**
 * Panel de compra de la pantalla de detalle.
 *
 * Aquí sí caben los tonos en línea: la pantalla es de un solo producto y
 * hay sitio de sobra. En la grilla del catálogo, en cambio, la paleta
 * vive en una hoja que solo se abre si la clienta la pide (ver
 * `HojaCompra`), porque ahí eran 591 paletas compitiendo por el espacio.
 */
export function PanelCompra({ producto }: { producto: Producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [tono, setTono] = useState<Tono | null>(null);
  const [agregado, setAgregado] = useState(false);

  const agregar = usarCarrito((e) => e.agregar);
  const establecer = usarCarrito((e) => e.establecer);

  // Los tonos comparten el inventario del producto: lo que ya está en la
  // bolsa reduce lo que todavía se puede agregar.
  const yaEnBolsa = usarUnidadesDeProducto(producto.id);
  const lineasDeEsteProducto = usarLineasDeProducto(producto.id);
  const disponible = Math.max(0, producto.stock - yaEnBolsa);

  if (producto.stock === 0) {
    return (
      <div className="rounded-tarjeta bg-petalo p-6 text-center shadow-petalo">
        <p className="font-display text-xl text-carbon-suave">Agotado por ahora</p>
        <p className="mt-1 text-carbon-suave">Vuelve pronto, reponemos seguido 💕</p>
      </div>
    );
  }

  if (producto.escalones.length === 0) {
    return (
      <p className="rounded-tarjeta bg-petalo p-6 text-center text-carbon-suave shadow-petalo">
        Este producto todavía no tiene precio configurado. Escríbenos y te lo
        cotizamos ✨
      </p>
    );
  }

  const tonos = producto.tonos;
  const necesitaTono = tonos.length > 0 || producto.numTonos > 0;
  const puedeAgregar = disponible > 0 && (!necesitaTono || tono !== null);

  // Los tonos comparten escalón: lo que ya está en la bolsa cuenta para
  // el precio de lo que se va a agregar ahora.
  const cantidadResultante = yaEnBolsa + cantidad;
  const unitarioAlAgregar = precioUnitarioPara(producto.escalones, cantidadResultante);
  const subtotal = unitarioAlAgregar * cantidad;

  // Precio al que están saliendo las unidades que ya tiene en la bolsa.
  const unitarioEnBolsa = precioUnitarioPara(producto.escalones, Math.max(1, yaEnBolsa));

  const upsell = sugerenciaUpsell(producto.escalones, cantidadResultante);
  const puedeLlegarAlUpsell = upsell !== null && upsell.nuevaCantidad <= producto.stock;

  function alAgregar() {
    agregar(producto.id, cantidad, tono);
    setAgregado(true);
    setCantidad(1);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(12);
    }

    setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <div className="space-y-5">
      <TablaEscalones escalones={producto.escalones} cantidadActual={cantidadResultante} />

      {necesitaTono && (
        <div className="space-y-3 rounded-tarjeta bg-petalo p-4 shadow-petalo">
          <h2 id="titulo-tonos-detalle" className="font-display text-lg text-carbon">
            Elige tu tono
            <span className="pl-1 font-sans text-base font-normal text-carbon-suave">
              ({tonos.length})
            </span>
          </h2>
          <SelectorTonos
            tonos={tonos}
            elegido={tono}
            alElegir={setTono}
            idEtiqueta="titulo-tonos-detalle"
          />
        </div>
      )}

      <div className="space-y-2 rounded-tarjeta bg-petalo p-4 shadow-petalo">
        <h2 className="text-center font-display text-lg text-carbon">¿Cuántas llevas?</h2>
        <SelectorCantidad
          valor={cantidad}
          cantidadMaxima={Math.max(1, disponible)}
          alCambiar={setCantidad}
        />
      </div>

      {puedeLlegarAlUpsell && (
        <p
          role="status"
          className="rounded-tarjeta bg-lila-suave/40 px-4 py-3 text-center text-[15px] text-lila-texto"
        >
          ✨ ¡Suma {upsell.unidadesFaltantes} más y te salen a{" "}
          <strong>{pesos(upsell.nuevoPrecioUnitario)} c/u</strong>!
          <br />
          Ahorras <strong>{pesos(upsell.ahorro)}</strong>
        </p>
      )}

      {disponible === 0 ? (
        <p className="text-center font-semibold text-alerta">
          Ya tienes en tu bolsa todo el stock disponible
        </p>
      ) : (
        producto.stock <= 5 && (
          <p className="text-center font-semibold text-alerta">
            Quedan solo {producto.stock} disponibles
          </p>
        )
      )}

      <Boton ancho tamano="grande" onClick={alAgregar} disabled={!puedeAgregar}>
        {agregado ? (
          <>
            <IconoCheck /> ¡Agregado a tu bolsa!
          </>
        ) : !puedeAgregar && necesitaTono && !tono ? (
          "Elige un tono primero"
        ) : (
          <>
            <IconoBolsa /> Agregar · {pesos(subtotal)}
          </>
        )}
      </Boton>

      {/* Al cambiar de tono se pierde de vista lo ya agregado en los otros
          tonos: este resumen lo deja siempre visible, cada tono aparte. */}
      {lineasDeEsteProducto.length > 0 && (
        <div className="rounded-tarjeta bg-rosa-nube p-4">
          <p className="pb-2 font-semibold text-carbon">En tu bolsa de este producto</p>
          <ul className="space-y-1">
            {lineasDeEsteProducto.map((l) => (
              <li
                key={l.tonoId ?? "sin-tono"}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-[15px] text-carbon">
                  {l.tonoNombre ?? "Sin tono"} · x{l.cantidad}
                </span>
                <span className="shrink-0 font-bold text-fucsia-texto">
                  {pesos(unitarioEnBolsa * l.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => establecer(producto.id, l.tonoId, 0)}
                  aria-label={`Quitar ${l.tonoNombre ?? producto.nombre} de la bolsa`}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center
                             rounded-full text-carbon-suave transition hover:bg-petalo
                             hover:text-fucsia-texto"
                >
                  <IconoBasura className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
