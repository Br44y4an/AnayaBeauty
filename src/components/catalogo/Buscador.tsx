"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { IconoBuscar } from "@/components/ui/Iconos";

export function Buscador() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [termino, setTermino] = useState(parametros.get("q") ?? "");
  const primeraCarga = useRef(true);

  // Espera a que deje de escribir para no consultar en cada tecla
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }

    const temporizador = setTimeout(() => {
      const nuevos = new URLSearchParams(parametros.toString());
      if (termino.trim()) nuevos.set("q", termino.trim());
      else nuevos.delete("q");
      router.replace(`/?${nuevos.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termino]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lila">
        <IconoBuscar />
      </span>

      <input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Busca por nombre o referencia…"
        aria-label="Buscar productos"
        className="min-h-[44px] w-full rounded-pastilla border-2 border-lila-suave
                   bg-petalo py-3 pl-12 pr-5 text-sm text-carbon outline-none
                   transition duration-200 placeholder:text-carbon-suave/60
                   focus:border-fucsia"
      />
    </div>
  );
}
