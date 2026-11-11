"use client";

import Link from "next/link";
import { IconoBolsa } from "@/components/ui/Iconos";
import { useTotalUnidades } from "@/lib/cart";

function etiqueta(unidades: number): string {
  if (unidades === 0) return "Bolsa";
  return `Bolsa, ${unidades} ${unidades === 1 ? "unidad" : "unidades"}`;
}

/** Bolsa de la cabecera; el contador cuenta unidades y cambia con un fundido, sin rebote. */
export function BotonBolsa() {
  const unidades = useTotalUnidades();

  return (
    <Link
      href="/carrito"
      aria-label={etiqueta(unidades)}
      className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2.5 rounded-md px-2.5
                 text-[15px] font-semibold leading-5 text-tinta transition-colors duration-150 hover:bg-superficie"
    >
      <IconoBolsa />
      <span className="hidden lg:inline">Bolsa</span>
      {/* Sobre el icono en el celular; en escritorio sigue al texto: «Bolsa 3». */}
      {unidades > 0 && (
        <span
          key={unidades}
          className="absolute right-0 top-0.5 flex h-5 min-w-5 animate-aparecer items-center justify-center rounded-full
                     bg-acento px-1 text-xs font-bold leading-none text-fondo tabular-nums ring-2 ring-fondo
                     lg:static lg:-ml-1 lg:ring-0"
        >
          {unidades > 99 ? "99+" : unidades}
        </span>
      )}
    </Link>
  );
}
