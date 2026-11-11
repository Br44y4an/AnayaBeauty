"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { IconoCerrar } from "@/components/ui/Iconos";

/** Aviso de una sola vez («Guardaste…»): quita su parámetro de la URL para que recargar no lo repita. */
export function AvisoLista({ parametro, children }: { parametro: string; children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(parametro)) return;
    url.searchParams.delete(parametro);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [parametro]);

  if (!visible) return null;

  return (
    <AvisoPanel
      tono="exito"
      accion={
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Cerrar aviso"
          className="-my-2 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta hover:bg-fondo"
        >
          <IconoCerrar tamano={20} />
        </button>
      }
    >
      {children}
    </AvisoPanel>
  );
}
