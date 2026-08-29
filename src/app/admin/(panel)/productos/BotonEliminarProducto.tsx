"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarProducto } from "./actions";
import { IconoBasura } from "@/components/ui/Iconos";

/**
 * Borrar es definitivo, así que el botón pide confirmación en el sitio:
 * un modal para una lista de cien productos se siente pesado.
 */
export function BotonEliminarProducto({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, iniciar] = useTransition();

  function eliminar() {
    setError(null);
    iniciar(async () => {
      const resultado = await eliminarProducto(id);
      if (resultado.ok) {
        setConfirmando(false);
        router.refresh();
      } else {
        setError(resultado.error);
      }
    });
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar ${nombre}`}
        title="Eliminar producto"
        className="flex min-h-[40px] w-10 cursor-pointer items-center justify-center
                   rounded-pastilla text-carbon-suave transition duration-200
                   hover:bg-fucsia/10 hover:text-fucsia focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-fucsia"
      >
        <IconoBasura className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-carbon-suave">¿Eliminar?</span>

        <button
          type="button"
          onClick={eliminar}
          disabled={eliminando}
          className="min-h-[40px] cursor-pointer rounded-pastilla bg-fucsia px-3 text-xs
                     font-semibold text-petalo transition hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-40"
        >
          {eliminando ? "Eliminando…" : "Sí, eliminar"}
        </button>

        <button
          type="button"
          onClick={() => {
            setConfirmando(false);
            setError(null);
          }}
          disabled={eliminando}
          className="min-h-[40px] cursor-pointer px-2 text-xs text-carbon-suave
                     underline transition hover:text-fucsia"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-fucsia">
          {error}
        </p>
      )}
    </div>
  );
}
