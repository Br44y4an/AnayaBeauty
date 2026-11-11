"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui/Boton";
import { IconoCheck } from "@/components/ui/Iconos";
import type { Resultado } from "@/lib/admin/resultado";
import { cambiarDestacado, cambiarVisibilidad } from "./actions";

type Accion = "visibilidad" | "destacado";

/** Ocultar/Mostrar y Destacar sin salir de la lista; la acción vuelve a pintar la lista al terminar. */
export function AccionesFila({
  id,
  nombre,
  activo,
  destacado,
}: {
  id: string;
  nombre: string;
  activo: boolean;
  destacado: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [enCurso, setEnCurso] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: Accion, llamar: () => Promise<Resultado>) {
    setError(null);
    setEnCurso(accion);
    iniciar(async () => {
      const resultado = await llamar();
      if (!resultado.ok) setError(resultado.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Boton
          variante="contorno"
          tamano="compacto"
          aria-label={`${activo ? "Ocultar" : "Mostrar"} ${nombre}`}
          className="min-w-24"
          cargando={pendiente && enCurso === "visibilidad"}
          disabled={pendiente}
          onClick={() => ejecutar("visibilidad", () => cambiarVisibilidad(id, !activo))}
        >
          {activo ? "Ocultar" : "Mostrar"}
        </Boton>
        <Boton
          variante={destacado ? "secundario" : "contorno"}
          tamano="compacto"
          aria-pressed={destacado}
          aria-label={`Destacar ${nombre}`}
          className="min-w-32"
          cargando={pendiente && enCurso === "destacado"}
          disabled={pendiente}
          onClick={() => ejecutar("destacado", () => cambiarDestacado(id, !destacado))}
        >
          {destacado && !(pendiente && enCurso === "destacado") && <IconoCheck tamano={18} />}
          Destacar
        </Boton>
      </div>
      {error && (
        <p role="alert" className="text-sm leading-5 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
