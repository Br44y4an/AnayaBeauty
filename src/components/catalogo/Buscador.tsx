"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useTransition } from "react";
import { IconoBuscar, IconoCerrar } from "@/components/ui/Iconos";

/**
 * Buscador del catálogo.
 *
 * Tres detalles que parecen pequeños y no lo son:
 *
 * · Espera 350ms tras la última tecla antes de consultar. Sin eso cada
 *   letra lanzaba una consulta y la pantalla parpadeaba mientras se
 *   escribía.
 * · Muestra que está buscando (`useTransition`). Antes no había ninguna
 *   señal entre teclear y ver el resultado, y eso se lee como "se trabó".
 * · Tiene botón para borrar. En celular, vaciar un campo largo tecla a
 *   tecla es un suplicio, y el aspa nativa del `type=search` no aparece
 *   en todos los navegadores.
 *
 * Al cambiar la búsqueda se vuelve a la primera tanda: quedarse en la
 * página 3 de unos resultados que ya no existen mostraba una lista vacía
 * sin explicación.
 */
export function Buscador() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendiente, iniciarTransicion] = useTransition();

  const enUrl = parametros.get("q") ?? "";
  const [termino, setTermino] = useState(enUrl);
  const primeraCarga = useRef(true);

  // Si la dirección cambia por fuera (atrás, un chip de categoría), el
  // campo tiene que seguirla o se queda mostrando algo que ya no filtra.
  useEffect(() => {
    setTermino(enUrl);
  }, [enUrl]);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    if (termino === enUrl) return;

    const temporizador = setTimeout(() => {
      const nuevos = new URLSearchParams(parametros.toString());
      if (termino.trim()) nuevos.set("q", termino.trim());
      else nuevos.delete("q");
      nuevos.delete("pagina");

      iniciarTransicion(() => {
        router.replace(nuevos.size ? `/?${nuevos}` : "/", { scroll: false });
      });
    }, 350);

    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termino]);

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lila-texto"
        aria-hidden="true"
      >
        {pendiente ? <Giro /> : <IconoBuscar className="h-5 w-5" />}
      </span>

      <input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Busca un producto o su referencia…"
        aria-label="Buscar productos"
        enterKeyHint="search"
        className="min-h-[52px] w-full rounded-pastilla border-2 border-lila-suave
                   bg-petalo py-3 pl-12 pr-12 text-base text-carbon outline-none
                   transition duration-200 placeholder:text-carbon-suave/70
                   focus:border-fucsia"
      />

      {termino && (
        <button
          type="button"
          onClick={() => setTermino("")}
          aria-label="Borrar la búsqueda"
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2
                     cursor-pointer items-center justify-center rounded-full
                     text-carbon-suave transition hover:text-fucsia-texto"
        >
          <IconoCerrar className="h-5 w-5" />
        </button>
      )}

      <span aria-live="polite" className="sr-only">
        {pendiente ? "Buscando productos" : ""}
      </span>
    </div>
  );
}

function Giro() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
