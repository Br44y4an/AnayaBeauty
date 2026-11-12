import type { ReactNode } from "react";

/** Tarjeta con título de cada parte del constructor; es una región con nombre para el lector de pantalla. */
export function SeccionRecibo({
  id,
  titulo,
  ayuda,
  accion,
  className = "",
  children,
}: {
  id: string;
  titulo: string;
  ayuda?: ReactNode;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className={`rounded-md border border-linea p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-xl font-semibold leading-[26px] text-tinta">
            {titulo}
          </h2>
          {ayuda && <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">{ayuda}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}
