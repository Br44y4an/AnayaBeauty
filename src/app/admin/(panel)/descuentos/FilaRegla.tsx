"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Boton } from "@/components/ui/Boton";
import { Insignia } from "@/components/ui/Insignia";
import type { Resultado } from "@/lib/admin/resultado";
import { pesos } from "@/lib/format";
import { cambiarReglaDescuento, eliminarReglaDescuento } from "./actions";

export type Regla = { id: string; montoMinimo: number; porcentaje: number; activo: boolean };

const porcentaje = (n: number) => `${n}\u00a0%`;

export function FilaRegla({ regla: r }: { regla: Regla }) {
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acciones = useRef<HTMLDivElement>(null);
  const titulo = `${porcentaje(r.porcentaje)} desde ${pesos(r.montoMinimo)}`;
  const ejemplo = pesos(r.montoMinimo - Math.round((r.montoMinimo * r.porcentaje) / 100));

  function ejecutar(llamar: () => Promise<Resultado>) {
    setError(null);
    iniciar(async () => {
      const resultado = await llamar().catch(() => null);
      if (!resultado?.ok) setError(resultado?.error ?? "No se pudo conectar. Intenta otra vez.");
    });
  }

  function preguntar(si: boolean) {
    flushSync(() => setConfirmando(si));
    acciones.current?.querySelector<HTMLButtonElement>(si ? "[data-cancelar]" : "[data-eliminar]")?.focus();
  }

  return (
    <div className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-5 text-tinta tabular-nums">
            {titulo}
            {!r.activo && <Insignia>Desactivado</Insignia>}
          </p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-tinta-suave tabular-nums">
            Un pedido de {pesos(r.montoMinimo)} paga {ejemplo}.
          </p>
        </div>

        <div ref={acciones} className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {confirmando ? (
            <>
              <span className="text-[15px] font-semibold text-tinta">¿Eliminar este descuento?</span>
              <Boton
                type="button"
                variante="peligro"
                tamano="compacto"
                cargando={pendiente}
                onClick={() => ejecutar(() => eliminarReglaDescuento(r.id))}
              >
                Sí, eliminar
              </Boton>
              <Boton
                type="button"
                variante="fantasma"
                tamano="compacto"
                disabled={pendiente}
                data-cancelar
                onClick={() => preguntar(false)}
              >
                Cancelar
              </Boton>
            </>
          ) : (
            <>
              <Boton
                type="button"
                variante="contorno"
                tamano="compacto"
                aria-label={`${r.activo ? "Desactivar" : "Activar"} ${titulo}`}
                className="min-w-28"
                cargando={pendiente}
                onClick={() => ejecutar(() => cambiarReglaDescuento(r.id, !r.activo))}
              >
                {r.activo ? "Desactivar" : "Activar"}
              </Boton>
              <Boton
                type="button"
                variante="fantasma"
                tamano="compacto"
                aria-label={`Eliminar ${titulo}`}
                disabled={pendiente}
                data-eliminar
                onClick={() => preguntar(true)}
              >
                Eliminar
              </Boton>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm leading-5 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
