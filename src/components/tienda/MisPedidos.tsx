"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoChevron } from "@/components/ui/Iconos";
import { leerPedidosGuardados, type PedidoGuardado } from "@/lib/celular";
import { fechaHora, pesos } from "@/lib/format";

/** Pedidos confirmados desde este celular, como los guardó la página de cada pedido. */
export function MisPedidos() {
  const [pedidos, setPedidos] = useState<PedidoGuardado[] | null>(null);

  // Viven en el navegador: se leen al montar para que el HTML del servidor y la hidratación coincidan.
  useEffect(() => setPedidos(leerPedidosGuardados()), []);

  if (pedidos === null) return null;

  if (pedidos.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-base text-tinta-suave">Aquí aparecen los pedidos que confirmes desde este celular.</p>
        <BotonEnlace href="/" variante="secundario" className="mt-6">
          Ver el catálogo
        </BotonEnlace>
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-linea border-y border-linea">
      {pedidos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/pedido/${encodeURIComponent(p.id)}`}
            className="flex min-h-18 items-center gap-4 py-3 transition-colors duration-150 hover:bg-superficie"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-6 text-tinta tabular-nums">
                Pedido {p.numero}
              </span>
              <span className="mt-0.5 block text-[13px] leading-[18px] text-tinta-suave">{fechaHora(p.fecha)}</span>
            </span>
            <span className="text-base font-semibold text-tinta tabular-nums">{pesos(p.total)}</span>
            <span className="flex items-center gap-0.5 text-[15px] font-semibold text-tinta">
              Ver
              <IconoChevron direccion="derecha" tamano={18} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
