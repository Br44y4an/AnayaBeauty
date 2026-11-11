"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconoChevron } from "@/components/ui/Iconos";
import { urlCatalogo } from "@/lib/rutas";
import type { Categoria, OrdenCatalogo } from "@/lib/types";

type Props = {
  departamentos: Pick<Categoria, "id" | "nombre" | "slug">[];
  /** Slug del departamento elegido; null es «Todo». */
  activo: string | null;
  orden: OrdenCatalogo;
  /** Con una búsqueda abierta «Todo» no se marca: sirve para volver al catálogo completo. */
  hayBusqueda?: boolean;
};

/** Si la clienta venía bajando, lleva la vista al inicio de los resultados (bajo la barra fija). */
function irAResultados() {
  const barra = document.getElementById("resultados");
  if (!barra) return;
  const fija = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  if (barra.getBoundingClientRect().top < fija) barra.scrollIntoView({ block: "start" });
}

export function PestanasDepartamentos({ departamentos, activo, orden, hayBusqueda = false }: Props) {
  const lista = useRef<HTMLUListElement>(null);
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false });
  const pestanas = [
    { clave: "todo", nombre: "Todo", href: urlCatalogo({ orden }), activa: activo === null && !hayBusqueda },
    ...departamentos.map((d) => ({
      clave: d.id,
      nombre: d.nombre,
      href: urlCatalogo({ categoria: d.slug, orden }),
      activa: d.slug === activo,
    })),
  ];

  // Centra la activa moviendo solo la fila: scrollIntoView también desplazaría la página.
  useEffect(() => {
    const fila = lista.current;
    const activa = fila?.querySelector<HTMLElement>('[aria-current="page"]');
    if (fila && activa) fila.scrollLeft = activa.offsetLeft - (fila.clientWidth - activa.offsetWidth) / 2;
  }, [activo, hayBusqueda]);

  useEffect(() => {
    const fila = lista.current;
    if (!fila) return;
    const medir = () => {
      const izquierda = fila.scrollLeft > 4;
      const derecha = fila.scrollLeft + fila.clientWidth < fila.scrollWidth - 4;
      setBordes((b) => (b.izquierda === izquierda && b.derecha === derecha ? b : { izquierda, derecha }));
    };
    medir();
    fila.addEventListener("scroll", medir, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(fila);
    return () => {
      fila.removeEventListener("scroll", medir);
      observador?.disconnect();
    };
  }, []);

  function desplazar(sentido: 1 | -1) {
    const fila = lista.current;
    if (!fila) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fila.scrollBy({ left: sentido * fila.clientWidth * 0.7, behavior: suave ? "smooth" : "auto" });
  }

  return (
    <nav aria-label="Departamentos" className="sticky top-14 z-20 border-b border-linea bg-fondo">
      <div className="relative mx-auto max-w-[1200px]">
        <ul
          ref={lista}
          className="relative flex overflow-x-auto px-1 [scrollbar-width:none] md:px-3 xl:px-5 [&::-webkit-scrollbar]:hidden"
        >
          {pestanas.map((p) => (
            <li key={p.clave} className="shrink-0">
              <Pestana href={p.href} activa={p.activa}>
                {p.nombre}
              </Pestana>
            </li>
          ))}
        </ul>
        <Borde lado="izquierda" visible={bordes.izquierda} alTocar={() => desplazar(-1)} />
        <Borde lado="derecha" visible={bordes.derecha} alTocar={() => desplazar(1)} />
      </div>
    </nav>
  );
}

function Pestana({ href, activa, children }: { href: string; activa: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={irAResultados}
      aria-current={activa ? "page" : undefined}
      className="relative flex h-11 items-center whitespace-nowrap px-3 text-[15px] font-medium leading-5
                 text-tinta-suave transition-colors duration-150 hover:text-tinta focus-visible:-outline-offset-2
                 aria-[current=page]:text-tinta"
    >
      {children}
      <Subrayado activa={activa} />
    </Link>
  );
}

/** Subrayado de 2 px; mientras llega el departamento tocado, late en la pestaña nueva. */
function Subrayado({ activa }: { activa: boolean }) {
  const { pending } = useLinkStatus();
  const color = activa ? "bg-tinta" : pending ? "animate-pulso bg-tinta-suave" : "bg-transparent";
  return <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full ${color}`} />;
}

/** Desvanecido que avisa que hay más pestañas; con mouse además es una flecha que desplaza la fila. */
function Borde({ lado, visible, alTocar }: { lado: "izquierda" | "derecha"; visible: boolean; alTocar: () => void }) {
  if (!visible) return null;
  const posicion =
    lado === "derecha" ? "right-0 justify-end bg-linear-to-l" : "left-0 justify-start bg-linear-to-r";
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={alTocar}
      className={`absolute inset-y-0 flex w-14 cursor-pointer items-center from-fondo from-45% to-transparent px-1
                  text-tinta pointer-coarse:pointer-events-none ${posicion}`}
    >
      <IconoChevron direccion={lado} tamano={20} className="hidden pointer-fine:block" />
    </button>
  );
}
