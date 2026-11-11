"use client";

import { useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { CELDA_TARJETA, TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { Boton } from "@/components/ui/Boton";
import { EsqueletoTarjeta } from "@/components/ui/Esqueleto";
import { urlCatalogo } from "@/lib/rutas";
import type { OrdenCatalogo, PaginaProductos, Producto } from "@/lib/types";

// El mismo tope que aplica obtenerProductos: después de la 10 la API repite la última página.
const PAGINA_MAXIMA = 10;
// Sin gap vertical en la grilla: las tarjetas son subgrids y lo heredarían entre sus 5 filas.
const SEPARACION_FILAS = "pb-6 lg:pb-10";

type Filtros = { categoria: string | null; q: string | null; orden: OrdenCatalogo };

type Props = {
  inicial: Producto[];
  total: number;
  /** Última página que trae `inicial` (el servidor pinta 1..N si la URL llega con `?pagina=N`). */
  pagina: number;
  filtros: Filtros;
};

/** Deja la página en la URL sin navegar: al recargar o compartir, el servidor pinta lo mismo. */
function recordarPagina(pagina: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("pagina", String(pagina));
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function ListaProductos({ inicial, total: totalInicial, pagina: paginaInicial, filtros }: Props) {
  const [productos, setProductos] = useState(inicial);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [estado, setEstado] = useState<"quieta" | "cargando" | "fallo">("quieta");
  const pidiendo = useRef(false);
  const lista = useRef<HTMLUListElement>(null);

  const faltan = productos.length < total;
  const puedePedir = faltan && pagina < PAGINA_MAXIMA;

  async function verMas(evento: MouseEvent<HTMLButtonElement>) {
    if (pidiendo.current) return;
    pidiendo.current = true;
    const teniaFoco = evento.currentTarget === document.activeElement;
    const siguiente = pagina + 1;
    setEstado("cargando");

    try {
      const respuesta = await fetch(`/api/catalogo${urlCatalogo({ ...filtros, pagina: siguiente }).slice(1)}`);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos: PaginaProductos = await respuesta.json();

      const vistos = new Set(productos.map((p) => p.id));
      const nuevos = datos.productos.filter((p) => !vistos.has(p.id));
      flushSync(() => {
        setProductos([...productos, ...nuevos]);
        setPagina(siguiente);
        // Sin nada nuevo (el catálogo se encogió) se da por vista toda la lista.
        setTotal(nuevos.length > 0 ? datos.total : productos.length);
        setEstado("quieta");
      });
      recordarPagina(siguiente);
      if (teniaFoco) lista.current?.children[productos.length]?.querySelector("a")?.focus();
    } catch {
      setEstado("fallo");
    } finally {
      pidiendo.current = false;
    }
  }

  return (
    <div>
      <ul ref={lista} className="grid grid-cols-2 gap-x-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {productos.map((producto, i) => (
          <li key={producto.id} className={`${CELDA_TARJETA} ${SEPARACION_FILAS}`}>
            <TarjetaProducto producto={producto} indice={i} />
          </li>
        ))}
        {estado === "cargando" &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={`cargando-${i}`} aria-hidden="true" className={`row-span-5 ${SEPARACION_FILAS}`}>
              <EsqueletoTarjeta />
            </li>
          ))}
      </ul>

      <div className="mt-4 flex flex-col items-center gap-3 text-center">
        <p aria-live="polite" className="text-sm leading-5 text-tinta-suave tabular-nums">
          Viendo {productos.length} de {total}
        </p>
        {estado === "fallo" && (
          <p role="alert" className="text-sm font-medium leading-5 text-error">
            No se pudo cargar.
          </p>
        )}
        {puedePedir && (
          <Boton
            variante="secundario"
            cargando={estado === "cargando"}
            onClick={verMas}
            className="w-full sm:w-auto sm:min-w-72"
          >
            {estado === "fallo" ? "Volver a intentar" : "Ver más productos"}
          </Boton>
        )}
        {faltan && !puedePedir && (
          <p className="max-w-xs text-sm leading-5 text-tinta-suave">
            Para ver el resto, elige una categoría o busca por nombre o referencia.
          </p>
        )}
      </div>
    </div>
  );
}
