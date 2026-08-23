"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cambiarEstadoPedido } from "./acciones-pedidos";
import { pesos } from "@/lib/format";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import type { Pedido, EstadoPedido } from "@/lib/types";

const ESTADOS: EstadoPedido[] = ["nuevo", "pagado", "enviado", "cancelado"];

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "bg-fucsia/10 text-fucsia",
  pagado: "bg-lila-suave/50 text-lila",
  enviado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-gray-100 text-gray-500",
};

/** Normaliza a formato internacional colombiano para el enlace de WhatsApp. */
function enlaceCliente(whatsapp: string): string {
  const soloDigitos = whatsapp.replace(/\D/g, "");
  const nacional = soloDigitos.slice(-10);
  return `https://wa.me/57${nacional}`;
}

export function TablaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);

  // Los pedidos nuevos entran solos: durante el live no hay que refrescar.
  useEffect(() => {
    const supabase = crearClienteNavegador();

    const canal = supabase
      .channel("pedidos-en-vivo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [router]);

  if (pedidos.length === 0) {
    return (
      <p className="py-16 text-center text-carbon-suave">
        Todavía no hay pedidos con ese filtro.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {pedidos.map((p) => (
        <li key={p.id} className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
          <button
            onClick={() => setAbierto(abierto === p.id ? null : p.id)}
            aria-expanded={abierto === p.id}
            className="flex w-full cursor-pointer items-start gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg text-carbon">{p.numeroPedido}</p>
              <p className="text-sm font-semibold text-carbon">{p.clienteNombre}</p>
              <p className="text-xs text-carbon-suave">
                {p.clienteWhatsapp} · {p.clienteCiudad}
                {p.codigoUsado && ` · código ${p.codigoUsado}`}
              </p>
              <p className="text-xs text-carbon-suave">
                {new Date(p.creadoEn).toLocaleString("es-CO", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-bold text-fucsia">{pesos(p.total)}</p>
              <span
                className={`mt-1 inline-block rounded-pastilla px-3 py-1 text-xs font-bold ${COLOR_ESTADO[p.estado]}`}
              >
                {p.estado}
              </span>
            </div>
          </button>

          {abierto === p.id && (
            <div className="mt-3 space-y-3 border-t border-rosa-nube pt-3">
              <ul className="space-y-1">
                {p.lineas.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="text-[11px] font-bold text-lila">{l.referencia}</span>{" "}
                      {l.nombre}{" "}
                      <span className="text-carbon-suave">x{l.cantidad}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-carbon">
                      {pesos(l.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== p.estado).map((e) => (
                  <button
                    key={e}
                    disabled={pendiente}
                    onClick={() =>
                      iniciarTransicion(async () => {
                        if (
                          e === "cancelado" &&
                          !confirm(
                            `¿Cancelar el pedido ${p.numeroPedido}? El stock volverá al inventario.`
                          )
                        )
                          return;

                        await cambiarEstadoPedido(p.id, e);
                        router.refresh();
                      })
                    }
                    className="min-h-[40px] cursor-pointer rounded-pastilla border
                               border-lila-suave px-4 text-xs font-semibold text-carbon-suave
                               transition duration-200 hover:border-fucsia hover:text-fucsia
                               disabled:opacity-40"
                  >
                    Marcar {e}
                  </button>
                ))}

                <a
                  href={enlaceCliente(p.clienteWhatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1
                             rounded-pastilla bg-fucsia px-4 text-xs font-semibold text-petalo"
                >
                  <IconoWhatsApp className="h-4 w-4" />
                  Escribirle
                </a>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
