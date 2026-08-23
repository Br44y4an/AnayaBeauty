"use client";

import { useState } from "react";
import { subtotalPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito } from "@/lib/cart";
import { Boton } from "@/components/ui/Boton";
import { IconoBolsa, IconoCheck } from "@/components/ui/Iconos";
import { SelectorCantidad } from "./SelectorCantidad";
import { TablaEscalones } from "./TablaEscalones";
import type { Producto } from "@/lib/types";

export function PanelCompra({ producto }: { producto: Producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const agregar = usarCarrito((e) => e.agregar);

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

  const subtotal = subtotalPara(producto.escalones, cantidad);
  const upsell = sugerenciaUpsell(producto.escalones, cantidad);

  // No se ofrece un escalón que el inventario no alcanza a cubrir:
  // prometer un ahorro imposible frustra a la clienta.
  const puedeLlegarAlUpsell = upsell !== null && upsell.nuevaCantidad <= producto.stock;

  function alAgregar() {
    agregar(producto.id, cantidad);
    setAgregado(true);

    // Vibración muy breve como confirmación táctil en celular
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }

    setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <div className="space-y-5">
      <TablaEscalones escalones={producto.escalones} cantidadActual={cantidad} />

      <SelectorCantidad
        valor={cantidad}
        cantidadMaxima={producto.stock}
        alCambiar={setCantidad}
      />

      {puedeLlegarAlUpsell && (
        <p
          role="status"
          className="rounded-tarjeta bg-lila-suave/40 px-4 py-3 text-center text-sm text-lila"
        >
          ✨ ¡Suma {upsell.unidadesFaltantes}{" "}
          {upsell.unidadesFaltantes === 1 ? "más" : "más"} y te salen a{" "}
          <strong>{pesos(upsell.nuevoPrecioUnitario)} c/u</strong>!
          <br />
          Ahorras <strong>{pesos(upsell.ahorro)}</strong>
        </p>
      )}

      {producto.stock <= 5 && (
        <p className="text-center text-sm font-semibold text-fucsia">
          Quedan solo {producto.stock} disponibles
        </p>
      )}

      <Boton ancho onClick={alAgregar}>
        {agregado ? (
          <>
            <IconoCheck /> ¡Agregado!
          </>
        ) : (
          <>
            <IconoBolsa /> Agregar · {pesos(subtotal)}
          </>
        )}
      </Boton>
    </div>
  );
}
