"use client";

import Link from "next/link";
import { useState } from "react";
import { IconoChevron, IconoInfo } from "@/components/ui/Iconos";
import { leerPedidosGuardados, type PedidoGuardado } from "@/lib/celular";
import { fechaCorta, fechaHora, pesos } from "@/lib/format";

const rutaPedido = (id: string) => `/pedido/${encodeURIComponent(id)}`;

/** Los últimos pedidos confirmados desde este celular. Sin ninguno no pinta nada. */
export function PedidosRecientes({ limite = 3 }: { limite?: number }) {
  // Solo se monta en el cliente (la bolsa vacía se sabe después de hidratar): leer aquí es seguro.
  const [pedidos] = useState(leerPedidosGuardados);
  if (pedidos.length === 0) return null;

  return (
    <section aria-labelledby="titulo-recientes" className="text-left">
      <h2 id="titulo-recientes" className="text-[15px] font-semibold leading-5 text-tinta">
        Tus pedidos en este celular
      </h2>
      {/* Mismas filas que /mis-pedidos: la clienta reconoce la lista. */}
      <ul className="mt-2 divide-y divide-linea border-y border-linea">
        {pedidos.slice(0, limite).map((p) => (
          <li key={p.id}>
            <Link
              href={rutaPedido(p.id)}
              className="flex min-h-18 items-center gap-4 py-3 transition-colors duration-150 hover:bg-superficie"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold leading-6 tabular-nums text-tinta">
                  Pedido {p.numero}
                </span>
                <span className="mt-0.5 block text-[13px] leading-[18px] text-tinta-suave">{fechaHora(p.fecha)}</span>
              </span>
              <span className="text-base font-semibold tabular-nums text-tinta">{pesos(p.total)}</span>
              <span className="flex items-center gap-0.5 text-[15px] font-semibold text-tinta">
                Ver
                <IconoChevron direccion="derecha" tamano={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pedidos.length > limite && (
        <Link href="/mis-pedidos" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">
          Ver todos tus pedidos
        </Link>
      )}
    </section>
  );
}

/** Mismo día de Bogotá que ahora: «hoy»; si no (la ventana es de 12 horas), «ayer». */
function cuando(fecha: string): string {
  return fechaCorta(fecha) === fechaCorta(new Date().toISOString()) ? "hoy" : "ayer";
}

/** Un pedido de las últimas 12 horas en este celular: el nuevo viaja como adicional para empacarlo junto. */
export function AvisoAdicional({ pedido }: { pedido: PedidoGuardado }) {
  return (
    <p className="flex items-start gap-2.5 rounded-md bg-superficie px-3.5 py-3 text-[15px] leading-5 text-tinta">
      <IconoInfo tamano={20} className="mt-px shrink-0 text-tinta-suave" />
      <span>
        Ya hiciste el pedido {pedido.numero} {cuando(pedido.fecha)}. Este se enviará como adicional para empacarlo
        junto.
      </span>
    </p>
  );
}
