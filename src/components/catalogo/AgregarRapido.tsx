"use client";

import { useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { IconoCheck } from "@/components/ui/Iconos";
import { Insignia } from "@/components/ui/Insignia";
import { Stepper } from "@/components/ui/Stepper";
import { mostrarAviso } from "@/lib/avisos";
import { useCarrito, useLineasDeProducto } from "@/lib/cart";
import { resumenDeCompra } from "@/lib/compra";
import { vibrar } from "@/lib/dispositivo";
import { rutaProducto } from "@/lib/rutas";
import { verboElegir } from "@/lib/variantes";
import type { Producto } from "@/lib/types";

const POCAS_UNIDADES = 5;

/**
 * Zona de compra de la tarjeta: lo único de la grilla suscrito a la bolsa, y solo a este producto.
 * Con variantes lleva a la ficha; sin variantes agrega aquí mismo y pasa a un stepper.
 */
export function AgregarRapido({ producto, idNombre }: { producto: Producto; idNombre?: string }) {
  const lineas = useLineasDeProducto(producto.id);
  const agregar = useCarrito((e) => e.agregar);
  const establecer = useCarrito((e) => e.establecer);
  const quitar = useCarrito((e) => e.quitar);
  const restaurar = useCarrito((e) => e.restaurar);
  // El botón que se toca desaparece (Agregar ↔ stepper): el foco pasa al control que ocupa su lugar.
  const refAgregar = useRef<HTMLButtonElement>(null);
  const refMas = useRef<HTMLButtonElement>(null);

  const enBolsa = lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const linea = lineas.find((l) => l.tonoId === null) ?? null;
  const compra = (unidadesNuevas: number) =>
    resumenDeCompra({ escalones: producto.escalones, stock: producto.stock, unidadesEnBolsa: enBolsa, unidadesNuevas });

  function agregarUna() {
    if (compra(1).bloqueo) return;
    flushSync(() => agregar(producto.id, 1, null));
    const mas = refMas.current;
    // Si esa era la última unidad, el «+» queda inactivo y el foco va al «−».
    (mas?.disabled ? mas.parentElement?.querySelector<HTMLButtonElement>("button:enabled") : mas)?.focus();
    vibrar();
    mostrarAviso({
      titulo: "Agregado a tu bolsa",
      detalle: `1 × ${producto.nombre}`,
      imagen: producto.imagenPrincipal,
      accion: { etiqueta: "Ver bolsa", href: "/carrito" },
    });
  }

  function cambiar(cantidad: number) {
    if (cantidad > 0) {
      establecer(producto.id, null, cantidad);
      return;
    }
    const todas = useCarrito.getState().lineas;
    const indice = todas.findIndex((l) => l.productoId === producto.id && l.tonoId === null);
    if (indice < 0) return;
    const quitada = todas[indice];
    flushSync(() => quitar(producto.id, null));
    refAgregar.current?.focus();
    mostrarAviso({
      titulo: "Quitado de tu bolsa",
      detalle: `${quitada.cantidad} × ${producto.nombre}`,
      imagen: producto.imagenPrincipal,
      accion: { etiqueta: "Deshacer", alHacer: () => restaurar(quitada, indice) },
    });
  }

  let accion: ReactNode;
  if (producto.numVariantes > 0) {
    accion = (
      <BotonEnlace
        href={rutaProducto(producto.referencia)}
        variante="contorno"
        tamano="compacto"
        ancho
        aria-describedby={idNombre}
      >
        {`${verboElegir(producto.etiquetaVariante)} · ${producto.numVariantes}`}
      </BotonEnlace>
    );
  } else if (linea) {
    accion = (
      <Stepper
        valor={linea.cantidad}
        max={linea.cantidad + compra(0).maxNuevas}
        onCambiar={cambiar}
        etiqueta={producto.nombre}
        tamano="compacto"
        className="w-full"
        refMas={refMas}
      />
    );
  } else {
    accion = (
      <Boton
        ref={refAgregar}
        variante="contorno"
        tamano="compacto"
        ancho
        onClick={agregarUna}
        disabled={compra(1).bloqueo !== null}
        aria-describedby={idNombre}
      >
        Agregar
      </Boton>
    );
  }

  const pocas = producto.stock > 0 && producto.stock <= POCAS_UNIDADES;

  return (
    <>
      {accion}
      {(enBolsa > 0 || pocas) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {enBolsa > 0 && (
            <p className="flex items-center gap-1 text-[13px] font-medium leading-[18px] text-ahorro">
              <IconoCheck tamano={16} className="shrink-0" />
              <span className="tabular-nums">{`${enBolsa} en tu bolsa`}</span>
            </p>
          )}
          {pocas && <Insignia tono="alerta">{`Quedan ${producto.stock}`}</Insignia>}
        </div>
      )}
    </>
  );
}
