import type { ReactNode } from "react";
import { IconoAlerta, IconoCheck } from "@/components/ui/Iconos";

const TONOS = {
  exito: { clase: "bg-ahorro-fondo", icono: <IconoCheck tamano={20} className="mt-0.5 shrink-0 text-ahorro" /> },
  alerta: { clase: "bg-alerta-fondo", icono: <IconoAlerta tamano={20} className="mt-0.5 shrink-0 text-alerta" /> },
  error: { clase: "bg-error-fondo", icono: <IconoAlerta tamano={20} className="mt-0.5 shrink-0 text-error" /> },
};

/** Resultado de una acción del panel: «Guardado», algo por revisar o el error real. El de error interrumpe al lector. */
export function AvisoPanel({
  tono,
  children,
  accion,
  className = "",
}: {
  tono: keyof typeof TONOS;
  children: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-md px-4 py-3 ${TONOS[tono].clase} ${className}`}
    >
      {TONOS[tono].icono}
      <div className="min-w-0 flex-1 text-[15px] leading-6 text-tinta">{children}</div>
      {accion}
    </div>
  );
}
