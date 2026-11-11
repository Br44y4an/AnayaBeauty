"use client";

import { useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Insignia } from "@/components/ui/Insignia";
import { Stepper } from "@/components/ui/Stepper";
import { IconoAlerta, IconoBuscar, IconoCerrar } from "@/components/ui/Iconos";
import { filtrarTonos, necesitaBorde } from "@/lib/tonos";
import { esNumeracionDeFoto, muestrasConfiables, pluralVariante, tituloSelector } from "@/lib/variantes";
import type { EtiquetaVariante, Variante } from "@/lib/types";

/** Desde 13 variantes la lista es larga: aparece el buscador y la ficha ensancha la compra en escritorio. */
const MINIMO_LISTA_LARGA = 13;

export type ManejadorSelector = { enfocar: () => void };

type Props = {
  variantes: Variante[];
  etiqueta: EtiquetaVariante;
  seleccion: Record<string, number>;
  enBolsa: Record<string, number>;
  /** Unidades que todavía caben: existencias menos lo que ya está en la bolsa. */
  disponibles: number;
  alCambiar: (id: string, cantidad: number) => void;
  error?: string | null;
  nivelTitulo?: 2 | 3;
  ref?: Ref<ManejadorSelector>;
};

// Una fila por variante en el orden guardado, que es el de la foto: agrupar por color desordena la
// leyenda. Los círculos solo aparecen si todas las muestras del producto son creíbles.
export function SelectorVariantes({
  variantes,
  etiqueta,
  seleccion,
  enBolsa,
  disponibles,
  alCambiar,
  error = null,
  nivelTitulo = 3,
  ref,
}: Props) {
  const id = useId();
  const seccion = useRef<HTMLElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [busqueda, setBusqueda] = useState("");

  useImperativeHandle(ref, () => ({
    enfocar() {
      lista.current?.focus({ preventScroll: true });
      seccion.current?.scrollIntoView({ block: "start" });
    },
  }));

  const ordenadas = [...variantes].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  const listaLarga = variantes.length >= MINIMO_LISTA_LARGA;
  const visibles = listaLarga ? filtrarTonos(ordenadas, busqueda) : ordenadas;
  const conMuestras = muestrasConfiables(variantes);
  const elegidas = Object.values(seleccion).reduce((total, n) => total + n, 0);
  const Titulo = nivelTitulo === 2 ? "h2" : "h3";

  // La lista pasa a dos columnas si su sección mide 32rem o más: solo pasa cuando FichaProducto lee
  // `data-lista-larga` y ensancha la compra en escritorio. En celular y en listas cortas, una columna.
  return (
    <section
      ref={seccion}
      aria-labelledby={`${id}-titulo`}
      data-lista-larga={listaLarga || undefined}
      className="@container scroll-mt-20"
    >
      <Titulo id={`${id}-titulo`} className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-tinta">
        {tituloSelector(etiqueta)}
      </Titulo>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm leading-5 text-error">
          <IconoAlerta tamano={18} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      {esNumeracionDeFoto(variantes) && (
        <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
          La numeración corresponde a la foto. Tócala para ampliarla.
        </p>
      )}

      {listaLarga && (
        <div className="mt-4">
          <label htmlFor={`${id}-buscar`} className="block text-[13px] font-medium leading-[18px] text-tinta-suave">
            {`Buscar entre ${pluralVariante(etiqueta, variantes.length)}`}
          </label>
          <div className="relative mt-1.5">
            <IconoBuscar
              tamano={20}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave"
            />
            <input
              id={`${id}-buscar`}
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              className="block min-h-12 w-full appearance-none rounded-md border border-borde bg-fondo py-2.5 pl-11 pr-12
                         text-base text-tinta [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Borrar búsqueda"
                className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center
                           justify-center rounded-md text-tinta-suave hover:text-tinta"
              >
                <IconoCerrar tamano={20} />
              </button>
            )}
          </div>
        </div>
      )}

      <ul
        ref={lista}
        tabIndex={-1}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={error ? `${id}-error` : undefined}
        className="-mx-2 mt-3 rounded-sm @min-[32rem]:grid @min-[32rem]:grid-cols-2 @min-[32rem]:gap-x-4"
      >
        {visibles.map((v) => {
          const cantidad = seleccion[v.id] ?? 0;
          return (
            <FilaVariante
              key={v.id}
              variante={v}
              cantidad={cantidad}
              enBolsa={enBolsa[v.id] ?? 0}
              maximo={Math.max(0, disponibles - (elegidas - cantidad))}
              conMuestra={conMuestras}
              alCambiar={alCambiar}
            />
          );
        })}
      </ul>
      {visibles.length === 0 && (
        <p className="py-4 text-[15px] leading-5 text-tinta-suave">
          No encontramos &quot;{busqueda.trim()}&quot;. Borra la búsqueda para ver la lista completa.
        </p>
      )}
    </section>
  );
}

function FilaVariante({
  variante: v,
  cantidad,
  enBolsa,
  maximo,
  conMuestra,
  alCambiar,
}: {
  variante: Variante;
  cantidad: number;
  enBolsa: number;
  maximo: number;
  conMuestra: boolean;
  alCambiar: (id: string, cantidad: number) => void;
}) {
  return (
    <li
      className={`flex min-h-14 items-center gap-3 border-t border-linea px-2 py-1.5 first:border-t-0
                  @min-[32rem]:nth-2:border-t-0 ${cantidad > 0 ? "bg-superficie" : ""}`}
    >
      {conMuestra && (
        <span
          data-testid="muestra"
          aria-hidden="true"
          style={{ backgroundColor: v.colorHex }}
          className={`size-7 shrink-0 rounded-full ring-1 ring-inset ${necesitaBorde(v.colorHex) ? "ring-borde" : "ring-linea"}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-base leading-5 text-balance ${v.agotado ? "text-tinta-suave" : "text-tinta"}`}>{v.nombre}</p>
        {enBolsa > 0 && <p className="mt-0.5 text-[13px] leading-[18px] text-ahorro">En tu bolsa: {enBolsa}</p>}
      </div>
      {v.agotado ? (
        <Insignia>Agotado</Insignia>
      ) : (
        <Stepper
          valor={cantidad}
          min={0}
          max={maximo}
          onCambiar={(n) => alCambiar(v.id, n)}
          etiqueta={v.nombre}
          tamano="compacto"
        />
      )}
    </li>
  );
}
