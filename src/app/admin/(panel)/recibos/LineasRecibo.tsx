"use client";

import { useRef, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { IconoMas } from "@/components/ui/Iconos";
import { Stepper } from "@/components/ui/Stepper";
import type { LineaTexto } from "@/lib/admin/recibo";
import { pesos } from "@/lib/format";
import type { Producto } from "@/lib/types";
import type { LineaEditable } from "./armarRecibo";
import { BuscadorProducto } from "./BuscadorProducto";
import type { LineaCatalogo } from "./estadoRecibo";
import { LineaTextoForm } from "./LineaTextoForm";
import { SeccionRecibo } from "./SeccionRecibo";

const PRECIO =
  "mt-1 block min-h-11 w-28 rounded-md border border-borde bg-fondo px-2 text-right text-base font-semibold tabular-nums text-tinta";
const FILA = "py-3 first:pt-0";

/** Productos del recibo: los del pedido o del catálogo (precio editable) y los escritos a mano. */
export function LineasRecibo({
  manual,
  productos,
  lineas,
  lineasTexto,
  alAgregarCatalogo,
  alCambiarCantidad,
  alCambiarPrecio,
  alGuardarTexto,
  alQuitarTexto,
}: {
  manual: boolean;
  productos: Producto[];
  lineas: LineaEditable[];
  lineasTexto: LineaTexto[];
  alAgregarCatalogo: (linea: LineaCatalogo) => void;
  alCambiarCantidad: (productoId: string, tonoId: string | null, cantidad: number) => void;
  alCambiarPrecio: (clave: string, valor: number) => void;
  alGuardarTexto: (linea: LineaTexto) => void;
  alQuitarTexto: (id: string) => void;
}) {
  // "nueva" = formulario para agregar; un id = esa línea en edición.
  const [editando, setEditando] = useState<string | null>(null);
  const botonAgregar = useRef<HTMLButtonElement>(null);
  const vacio = lineas.length === 0 && lineasTexto.length === 0;

  function cerrar() {
    setEditando(null);
    requestAnimationFrame(() => botonAgregar.current?.focus());
  }

  return (
    <SeccionRecibo id="recibo-productos" titulo="Productos">
      {manual && <BuscadorProducto productos={productos} alAgregar={alAgregarCatalogo} />}

      {vacio && editando === null && (
        <p className="mt-3 text-[15px] leading-6 text-tinta-suave">
          {manual ? "Todavía no agregas productos." : "Este pedido no tiene productos."}
        </p>
      )}

      {!vacio && (
        <ul className={`divide-y divide-linea ${manual ? "mt-4 border-t border-linea pt-3" : ""}`}>
          {lineas.map((l) => {
            const nombre = `${l.nombre}${l.tono ? `, ${l.tono}` : ""}`;
            return (
              <li key={l.clave} className={FILA}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                      Ref. {l.referencia}
                    </p>
                    <p className="text-[15px] leading-5 text-tinta">
                      {l.nombre}
                      {l.tono && <span className="font-semibold"> · {l.tono}</span>}
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-tinta">{pesos(l.subtotal)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                  {manual && l.productoId ? (
                    <Stepper
                      valor={l.cantidad}
                      min={1}
                      max={999}
                      tamano="compacto"
                      etiqueta={nombre}
                      onCambiar={(n) => alCambiarCantidad(l.productoId!, l.tonoId ?? null, n)}
                    />
                  ) : (
                    <p className="flex min-h-11 items-center text-sm tabular-nums text-tinta-suave">
                      {l.cantidad} {l.cantidad === 1 ? "unidad" : "unidades"}
                    </p>
                  )}
                  <label className="block">
                    <span className="block text-[13px] leading-[18px] text-tinta-suave">Precio c/u</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Precio unitario de ${nombre}`}
                      className={PRECIO}
                      value={l.precioUnitario}
                      onChange={(e) => alCambiarPrecio(l.clave, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    />
                  </label>
                  {manual && l.productoId && (
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="compacto"
                      className="ml-auto px-3"
                      aria-label={`Quitar ${nombre}`}
                      onClick={() => alCambiarCantidad(l.productoId!, l.tonoId ?? null, 0)}
                    >
                      Quitar
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}

          {lineasTexto.map((l) =>
            editando === l.id ? (
              <li key={l.id} className={FILA}>
                <LineaTextoForm
                  inicial={l}
                  alCancelar={cerrar}
                  alGuardar={(linea) => {
                    alGuardarTexto(linea);
                    cerrar();
                  }}
                />
              </li>
            ) : (
              <li key={l.id} className={FILA}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                      En texto
                    </p>
                    <p className="break-words text-[15px] leading-5 text-tinta">{l.descripcion}</p>
                    <p className="text-[13px] leading-[18px] tabular-nums text-tinta-suave">
                      {l.cantidad} × {pesos(l.precioUnitario)} c/u
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-tinta">
                    {pesos(l.cantidad * l.precioUnitario)}
                  </p>
                </div>
                <div className="mt-1 flex justify-end gap-1">
                  <Boton
                    type="button"
                    variante="fantasma"
                    tamano="compacto"
                    className="px-3"
                    aria-label={`Editar ${l.descripcion}`}
                    onClick={() => setEditando(l.id)}
                  >
                    Editar
                  </Boton>
                  <Boton
                    type="button"
                    variante="fantasma"
                    tamano="compacto"
                    className="px-3"
                    aria-label={`Quitar ${l.descripcion}`}
                    onClick={() => {
                      alQuitarTexto(l.id);
                      requestAnimationFrame(() => botonAgregar.current?.focus());
                    }}
                  >
                    Quitar
                  </Boton>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <div className="mt-4 border-t border-linea pt-4">
        {editando === "nueva" ? (
          <LineaTextoForm
            alCancelar={cerrar}
            alGuardar={(linea) => {
              alGuardarTexto(linea);
              cerrar();
            }}
          />
        ) : (
          <Boton
            ref={botonAgregar}
            type="button"
            variante="contorno"
            tamano="compacto"
            disabled={editando !== null}
            onClick={() => setEditando("nueva")}
          >
            <IconoMas tamano={20} />
            Agregar producto en texto
          </Boton>
        )}
        <p className="mt-2 text-[13px] leading-[18px] text-tinta-suave">
          Para envíos, productos que no están en el catálogo o servicios.
        </p>
      </div>
    </SeccionRecibo>
  );
}
