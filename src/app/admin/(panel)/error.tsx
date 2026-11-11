"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { IconoAlerta } from "@/components/ui/Iconos";

/** Error propio del panel: la navegación sigue a la vista (el layout queda fuera de este límite). */
export default function ErrorPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-10">
      <IconoAlerta tamano={32} className="text-error" />
      <h1 className="mt-4 text-2xl font-semibold leading-[30px] text-tinta">Algo no cargó bien</h1>
      <p className="mt-2 text-base leading-6 text-tinta-suave">
        Puede ser la conexión. Lo que ya guardaste sigue guardado.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Boton type="button" onClick={() => retry()}>
          Volver a intentar
        </Boton>
        <Boton type="button" variante="contorno" onClick={() => window.location.reload()}>
          Recargar la página
        </Boton>
      </div>

      {error.digest && (
        <p className="mt-6 text-[13px] leading-[18px] text-tinta-suave">
          Si se repite, comparte este código con quien te ayuda con la tienda: {error.digest}
        </p>
      )}
    </div>
  );
}
