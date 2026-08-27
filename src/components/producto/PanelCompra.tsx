"use client";

import { useState } from "react";
import { precioUnitarioPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito, unidadesDeProducto } from "@/lib/cart";
import { Boton } from "@/components/ui/Boton";
import { IconoBolsa, IconoCheck } from "@/components/ui/Iconos";
import { SelectorCantidad } from "./SelectorCantidad";
import { SelectorTonos } from "./SelectorTonos";
import { TablaEscalones } from "./TablaEscalones";
import type { Producto, Tono } from "@/lib/types";

export function PanelCompra({ producto }: { producto: Producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [tono, setTono] = useState<Tono | null>(null);
  const [agregado, setAgregado] = useState(false);

  const agregar = usarCarrito((e) => e.agregar);
  const lineas = usarCarrito((e) => e.lineas);

  // Los tonos comparten el inventario del producto: lo que ya está en la
  // bolsa reduce lo que todavía se puede agregar.
  const yaEnBolsa = unidadesDeProducto(lineas, producto.id);
  const disponible = Math.max(0, producto.stock - yaEnBolsa);
  const lineasDeEsteProducto = lineas.filter((l) => l.productoId === producto.id);

  if (producto.stock === 0) {
    return (
      <div className="rounded-tarjeta bg-petalo p-6 text-center shadow-petalo">
        <p className="font-display text-xl text-carbon-suave">Agotado por ahora</p>
        <p className="mt-1 text-sm text-carbon-suave">
          Vuelve pronto, reponemos seguido 💕
        </p>
      </div>
    );
  }

  if (producto.escalones.length === 0) {
    return (
      <p className="rounded-tarjeta bg-petalo p-6 text-center text-carbon-suave shadow-petalo">
        Este producto todavía no tiene precio configurado.
      </p>
    );
  }

  const necesitaTono = producto.tonos.length > 0;
  const puedeAgregar = disponible > 0 && (!necesitaTono || tono !== null);

  // Los tonos comparten escalón: lo que ya está en la bolsa cuenta para el
  // precio de lo que se va a agregar ahora.
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
      navigator.vibrate?.(10);
    }

    setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <div className="space-y-5">
      <TablaEscalones escalones={producto.escalones} cantidadActual={cantidadResultante} />

      {necesitaTono && (
        <div className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
          <SelectorTonos tonos={producto.tonos} elegido={tono} alElegir={setTono} />
        </div>
      )}

      <SelectorCantidad
        valor={cantidad}
        cantidadMaxima={Math.max(1, disponible)}
        alCambiar={setCantidad}
      />

      {puedeLlegarAlUpsell && (
        <p
          role="status"
          className="rounded-tarjeta bg-lila-suave/40 px-4 py-3 text-center text-sm text-lila"
        >
          ✨ ¡Suma {upsell.unidadesFaltantes} más y te salen a{" "}
          <strong>{pesos(upsell.nuevoPrecioUnitario)} c/u</strong>!
          <br />
          Ahorras <strong>{pesos(upsell.ahorro)}</strong>
        </p>
      )}

      {disponible === 0 ? (
        <p className="text-center text-sm font-semibold text-fucsia">
          Ya tienes en tu bolsa todo el stock disponible
        </p>
      ) : (
        producto.stock <= 5 && (
          <p className="text-center text-sm font-semibold text-fucsia">
            Quedan solo {producto.stock} disponibles
          </p>
        )
      )}

      <Boton ancho onClick={alAgregar} disabled={!puedeAgregar}>
        {agregado ? (
          <>
            <IconoCheck /> ¡Agregado!
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
      {necesitaTono && lineasDeEsteProducto.length > 0 && (
        <div className="rounded-tarjeta bg-rosa-nube p-4">
          <p className="pb-2 text-xs font-semibold text-carbon-suave">
            En tu bolsa de este producto
          </p>
          <ul className="space-y-1">
            {lineasDeEsteProducto.map((l) => (
              <li
                key={l.tonoId ?? "sin-tono"}
                className="flex items-center justify-between gap-2 text-sm text-carbon"
              >
                <span className="truncate">
                  {l.tonoNombre ?? "Sin tono"} · x{l.cantidad}
                </span>
                <span className="shrink-0 font-semibold text-fucsia">
                  {pesos(unitarioEnBolsa * l.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
