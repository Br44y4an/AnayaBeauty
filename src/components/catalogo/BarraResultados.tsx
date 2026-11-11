"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Giro } from "@/components/ui/Giro";
import { IconoChevron } from "@/components/ui/Iconos";
import { ordenDeParametro, urlCatalogo } from "@/lib/rutas";
import type { OrdenCatalogo } from "@/lib/types";

const OPCIONES: { valor: OrdenCatalogo; etiqueta: string }[] = [
  { valor: "destacados", etiqueta: "Recomendados" },
  { valor: "precio-asc", etiqueta: "Precio: menor a mayor" },
  { valor: "precio-desc", etiqueta: "Precio: mayor a menor" },
  { valor: "nuevos", etiqueta: "Más nuevos" },
];

type Props = {
  titulo: string;
  total: number;
  /** Los filtros llegan del servidor: con la vista rápida abierta la URL visible es la del producto. */
  categoria: string | null;
  q: string | null;
  orden: OrdenCatalogo;
};

/** «Labios · 43 productos» y el orden. Es el destino al cambiar de departamento (#resultados). */
export function BarraResultados({ titulo, total, categoria, q, orden }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mostrado, mostrar] = useOptimistic(orden);
  const etiqueta = OPCIONES.find((o) => o.valor === mostrado)?.etiqueta ?? OPCIONES[0].etiqueta;

  function ordenar(valor: string) {
    const nuevo = ordenDeParametro(valor);
    iniciar(() => {
      mostrar(nuevo);
      router.replace(urlCatalogo({ categoria, q, orden: nuevo }), { scroll: false });
    });
  }

  return (
    <div id="resultados" className="flex items-center justify-between gap-x-4 gap-y-2 pb-3 pt-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-tinta sm:inline">{titulo}</h1>
        <p className="text-sm leading-5 text-tinta-suave tabular-nums sm:ml-2 sm:inline">
          <span aria-hidden="true" className="mr-2 hidden sm:inline">
            ·
          </span>
          {total === 1 ? "1 producto" : `${total} productos`}
        </p>
      </div>

      {total > 0 && (
        <label
          className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-md pl-2 text-sm
                     leading-5 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2
                     has-[select:focus-visible]:outline-acento"
        >
          <span aria-hidden="true" className="text-tinta-suave">
            Ordenar:
          </span>
          <span aria-hidden="true" className="font-semibold text-tinta">
            {etiqueta}
          </span>
          {pendiente ? (
            <Giro className="size-4 text-tinta" />
          ) : (
            <IconoChevron direccion="abajo" tamano={18} className="text-tinta" />
          )}
          {/* Invisible encima de la cara: abre la lista nativa del sistema, con su tamaño de letra. */}
          <select
            value={mostrado}
            onChange={(e) => ordenar(e.target.value)}
            aria-label="Ordenar"
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          >
            {OPCIONES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
