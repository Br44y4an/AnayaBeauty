"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoEliminar, IconoMas } from "@/components/ui/Iconos";
import { CONTROL, MensajeError } from "@/components/admin/CamposPanel";
import { pesos } from "@/lib/format";
import type { Escalon } from "@/lib/pricing";

type Fila = { clave: number; minimo: string; precio: string };

const MAX_FILAS = 10;

/** «8.000», «$8.000» y «8000» son lo mismo: en un campo numérico, «8.000» se leería como 8. */
const aEntero = (texto: string) => {
  const digitos = texto.replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
};

function siguienteMinimo(filas: Fila[]): string {
  const mayor = Math.max(...filas.map((f) => aEntero(f.minimo) ?? 1));
  return String(mayor === 1 ? 3 : mayor * 2);
}

/** Precios por cantidad: el primero siempre es 1 unidad. Viajan como JSON en `escalones`. */
export function EditorEscalones({ iniciales, error }: { iniciales: Escalon[]; error?: string | null }) {
  const contador = useRef(0);
  const nueva = (minimo: string, precio = ""): Fila => ({ clave: contador.current++, minimo, precio });
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.length > 0
      ? iniciales.map((e) => nueva(String(e.minCantidad), String(e.precioUnitario)))
      : [nueva("1")]
  );
  const precios = useRef(new Map<number, HTMLInputElement>());
  const botonAgregar = useRef<HTMLButtonElement>(null);

  const enviados = filas.map((f) => ({ minCantidad: aEntero(f.minimo), precioUnitario: aEntero(f.precio) }));
  const vista = enviados
    .filter((e): e is Escalon => e.minCantidad !== null && e.precioUnitario !== null && e.precioUnitario > 0)
    .sort((a, b) => a.minCantidad - b.minCantidad);

  function cambiar(clave: number, campo: "minimo" | "precio", valor: string) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }

  function agregar() {
    const fila = nueva(siguienteMinimo(filas));
    flushSync(() => setFilas((previas) => [...previas, fila]));
    precios.current.get(fila.clave)?.focus();
  }

  function quitar(indice: number) {
    const vecina = filas[indice + 1] ?? filas[indice - 1];
    flushSync(() => setFilas((previas) => previas.filter((_, i) => i !== indice)));
    (precios.current.get(vecina.clave) ?? botonAgregar.current)?.focus();
  }

  return (
    <fieldset
      aria-describedby={["escalones-ayuda", error ? "escalones-error" : ""].filter(Boolean).join(" ")}
      data-invalido={error ? true : undefined}
      className="space-y-4"
    >
      <legend className="text-xl font-semibold leading-[26px] text-tinta">Precios por cantidad</legend>
      <p id="escalones-ayuda" className="text-[13px] leading-[18px] text-tinta-suave">
        El primero es el precio de 1 unidad. Agrega otros para premiar a quien lleva varias, por ejemplo desde 3
        a $7.500. Los tonos de un mismo producto suman juntos.
      </p>
      {error && <MensajeError id="escalones-error">{error}</MensajeError>}

      <input type="hidden" name="escalones" value={JSON.stringify(enviados)} />

      <ul className="space-y-3">
        {filas.map((f, i) => {
          const minimo = aEntero(f.minimo);
          return (
            <li key={f.clave} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-end gap-3">
              <div>
                <label htmlFor={`minimo-${f.clave}`} className="block text-[13px] font-semibold leading-[18px] text-tinta">
                  Desde (unidades)
                </label>
                <input
                  id={`minimo-${f.clave}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={f.minimo}
                  readOnly={i === 0}
                  aria-describedby={i === 0 ? "escalones-ayuda" : undefined}
                  onChange={(e) => cambiar(f.clave, "minimo", e.target.value)}
                  className={`${CONTROL} tabular-nums read-only:bg-superficie read-only:text-tinta-suave`}
                />
              </div>
              <div>
                <label htmlFor={`precio-${f.clave}`} className="block text-[13px] font-semibold leading-[18px] text-tinta">
                  Precio c/u
                </label>
                <input
                  id={`precio-${f.clave}`}
                  ref={(nodo) => {
                    if (nodo) precios.current.set(f.clave, nodo);
                    else precios.current.delete(f.clave);
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  value={f.precio}
                  onChange={(e) => cambiar(f.clave, "precio", e.target.value)}
                  className={`${CONTROL} tabular-nums`}
                />
              </div>
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar el precio desde ${minimo ?? "esa cantidad de"} unidades`}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-md text-tinta hover:bg-superficie"
                >
                  <IconoEliminar tamano={20} />
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>

      {filas.length < MAX_FILAS && (
        <button
          ref={botonAgregar}
          type="button"
          onClick={agregar}
          className={estilosBoton({ variante: "contorno", tamano: "compacto" })}
        >
          <IconoMas tamano={20} />
          Agregar precio por cantidad
        </button>
      )}

      {vista.length > 0 && (
        <div className="rounded-md bg-superficie px-4 py-3">
          <p className="text-[13px] font-semibold leading-[18px] text-tinta">Así lo verá la clienta</p>
          <p className="mt-1 text-[15px] leading-6 text-tinta tabular-nums">
            {vista
              .map((e) => `${e.minCantidad === 1 ? "1 u" : `${e.minCantidad}+`} ${pesos(e.precioUnitario)}`)
              .join(" · ")}
          </p>
        </div>
      )}
    </fieldset>
  );
}
