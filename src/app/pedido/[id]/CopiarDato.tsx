"use client";

import { useState } from "react";
import { IconoCheck } from "@/components/ui/Iconos";

/**
 * Número de pago con botón de copiar.
 *
 * Copiar 10 dígitos a ojo de una pantalla a la app del banco es donde se
 * equivoca la gente, y un dígito mal escrito convierte un pago en un
 * problema de media hora por WhatsApp. Un toque y ya está.
 *
 * `navigator.clipboard` no existe fuera de HTTPS ni en navegadores muy
 * viejos: si falla, el número sigue ahí, grande y seleccionable, así que
 * nadie se queda sin poder pagar.
 */
export function CopiarDato({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(10);
      }
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles disponible: el número queda visible para
      // copiarlo a mano, que es exactamente como estaba antes.
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <p className="select-all text-2xl font-bold tracking-wide text-carbon">{valor}</p>

      <button
        type="button"
        onClick={copiar}
        className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-pastilla
                   border-2 border-fucsia-suave px-4 text-sm font-semibold
                   text-fucsia-texto transition hover:border-fucsia"
      >
        {copiado ? (
          <>
            <IconoCheck className="h-4 w-4" /> ¡Copiado!
          </>
        ) : (
          "Copiar"
        )}
      </button>

      <span aria-live="polite" className="sr-only">
        {copiado ? "Número copiado al portapapeles" : ""}
      </span>
    </div>
  );
}
