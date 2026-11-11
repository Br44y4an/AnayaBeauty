"use client";

import { useRef, useState } from "react";
import { IconoCheck, IconoCopiar } from "@/components/ui/Iconos";
import { vibrar } from "@/lib/dispositivo";

// Copiar a mano 10 dígitos de una pantalla al banco es donde se equivoca la gente. Sin portapapeles (sin
// HTTPS o navegador viejo) no pasa nada: el dato sigue visible y seleccionable.
export function CopiarDato({ valor, texto = "Copiar" }: { valor: string; texto?: string }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      return;
    }
    vibrar(10);
    setCopiado(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-borde
                   bg-fondo px-3 text-[15px] font-semibold text-tinta transition-colors duration-150
                   hover:border-tinta active:bg-superficie"
      >
        {copiado ? <IconoCheck tamano={18} className="text-ahorro" /> : <IconoCopiar tamano={18} />}
        {copiado ? "Copiado" : texto}
      </button>
      <span aria-live="polite" className="sr-only">
        {copiado ? "Copiado" : ""}
      </span>
    </>
  );
}
