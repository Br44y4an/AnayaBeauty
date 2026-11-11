"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoMas } from "@/components/ui/Iconos";
import { MensajeError } from "@/components/admin/CamposPanel";
import { nombreVariante, unaVariante } from "@/lib/variantes";
import type { VarianteEditable } from "@/lib/admin/variantes";
import type { EtiquetaVariante, Variante } from "@/lib/types";
import { FilaVariante, SIN_COLOR, type FilaEditable } from "./FilaVariante";

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Variantes en el orden de la foto (la fila 1 es el número 1). Se guardan por id con `diffVariantes`:
 * renombrar o reordenar no cambia los ids que tienen las bolsas guardadas.
 */
export function EditorVariantes({
  iniciales,
  etiqueta,
  error,
}: {
  iniciales: Variante[];
  etiqueta: EtiquetaVariante;
  error?: string | null;
}) {
  const contador = useRef(0);
  const [filas, setFilas] = useState<FilaEditable[]>(() =>
    iniciales.map(({ id, nombre, colorHex, agotado }) => ({ clave: id, id, nombre, colorHex, agotado }))
  );
  const [anuncio, setAnuncio] = useState("");
  const controles = useRef(new Map<string, HTMLElement>());
  const botonAgregar = useRef<HTMLButtonElement>(null);

  const singular = nombreVariante(etiqueta);
  const plural = nombreVariante(etiqueta, 2);
  const articulo = unaVariante(etiqueta).startsWith("una ") ? "la" : "el";
  const enviadas: VarianteEditable[] = filas.map(({ id, nombre, colorHex, agotado }) => ({ id, nombre, colorHex, agotado }));
  const nombreDe = (f: FilaEditable, i: number) => f.nombre.trim() || `la fila ${i + 1}`;

  const registrar = (clave: string) => (nodo: HTMLElement | null) => {
    if (nodo) controles.current.set(clave, nodo);
    else controles.current.delete(clave);
  };
  const enfocar = (...claves: string[]) => {
    const destino = claves.map((c) => controles.current.get(c)).find((n) => n && !n.hasAttribute("disabled"));
    destino?.focus();
  };

  function cambiar(clave: string, cambio: Partial<FilaEditable>) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
  }

  function mover(indice: number, paso: -1 | 1) {
    const fila = filas[indice];
    const destino = indice + paso;
    flushSync(() =>
      setFilas((previas) => {
        const copia = [...previas];
        [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
        return copia;
      })
    );
    // Al mover, el foco se queda en la misma fila (o en su otra flecha si llegó al extremo).
    const [mismo, otro] = paso < 0 ? ["subir", "bajar"] : ["bajar", "subir"];
    enfocar(`${fila.clave}:${mismo}`, `${fila.clave}:${otro}`);
    setAnuncio(`${capitalizar(nombreDe(fila, indice))} quedó en la posición ${destino + 1}.`);
  }

  function quitar(indice: number) {
    const fila = filas[indice];
    const vecina = filas[indice + 1] ?? filas[indice - 1];
    flushSync(() => setFilas((previas) => previas.filter((_, i) => i !== indice)));
    if (vecina) enfocar(`${vecina.clave}:nombre`);
    else botonAgregar.current?.focus();
    setAnuncio(fila.id ? `Quitaste ${nombreDe(fila, indice)}. Se borra al guardar.` : `Quitaste ${nombreDe(fila, indice)}.`);
  }

  function agregar() {
    const clave = `nueva-${contador.current++}`;
    flushSync(() =>
      setFilas((previas) => [...previas, { clave, id: null, nombre: "", colorHex: SIN_COLOR, agotado: false }])
    );
    enfocar(`${clave}:nombre`);
  }

  return (
    <fieldset
      aria-describedby={["variantes-ayuda", error ? "variantes-error" : ""].filter(Boolean).join(" ")}
      data-invalido={error ? true : undefined}
      className="space-y-4"
    >
      <legend className="text-xl font-semibold leading-[26px] text-tinta">
        {capitalizar(plural)}
        <span className="ml-2 text-base font-normal text-tinta-suave tabular-nums">{filas.length}</span>
      </legend>
      <div id="variantes-ayuda" className="space-y-1 text-[13px] leading-[18px] text-tinta-suave">
        <p>
          Van en el orden de la foto: la fila 1 es {articulo} {singular} 1. Lo que se acabe, márcalo «Agotado» en
          vez de quitarlo: así la numeración sigue igual que en la foto.
        </p>
        <p>La muestra de color es opcional. Mientras alguna quede sin elegir, la tienda no pinta los círculos de color.</p>
      </div>
      {error && <MensajeError id="variantes-error">{error}</MensajeError>}

      <input type="hidden" name="variantes" value={JSON.stringify(enviadas)} />

      {filas.length === 0 ? (
        <p className="text-[15px] text-tinta-suave">Sin {plural}: la clienta elige solo la cantidad.</p>
      ) : (
        <div>
          <p aria-hidden="true" className="flex gap-3 pb-2 text-[13px] font-semibold leading-[18px] text-tinta">
            <span className="w-6 shrink-0 text-right">N.º</span>
            <span className="w-11 shrink-0">Color</span>
            <span>Nombre</span>
          </p>
          <ol className="divide-y divide-linea border-y border-linea">
            {filas.map((f, i) => (
              <FilaVariante
                key={f.clave}
                fila={f}
                posicion={i + 1}
                esPrimera={i === 0}
                esUltima={i === filas.length - 1}
                registrar={registrar}
                alCambiar={(cambio) => cambiar(f.clave, cambio)}
                alMover={(paso) => mover(i, paso)}
                alQuitar={() => quitar(i)}
              />
            ))}
          </ol>
        </div>
      )}

      <button
        ref={botonAgregar}
        type="button"
        onClick={agregar}
        className={estilosBoton({ variante: "contorno", tamano: "compacto" })}
      >
        <IconoMas tamano={20} />
        Agregar {singular}
      </button>

      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </fieldset>
  );
}
