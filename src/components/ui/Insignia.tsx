import type { ReactNode } from "react";

type Tono = "neutro" | "alerta" | "ahorro" | "error";

const TONOS: Record<Tono, string> = {
  neutro: "bg-fondo text-tinta ring-1 ring-inset ring-linea",
  alerta: "bg-alerta-fondo text-alerta",
  ahorro: "bg-ahorro-fondo text-ahorro",
  error: "bg-error-fondo text-error",
};

/** Etiqueta corta de estado («Agotado», «Quedan 3»), 12 px. */
export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold leading-4 ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}
