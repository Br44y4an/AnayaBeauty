"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { OrdenCatalogo } from "@/lib/data/catalog";

const OPCIONES: { valor: OrdenCatalogo; etiqueta: string }[] = [
  { valor: "destacados", etiqueta: "Los que recomendamos" },
  { valor: "precio-asc", etiqueta: "Precio: de menor a mayor" },
  { valor: "precio-desc", etiqueta: "Precio: de mayor a menor" },
  { valor: "nuevos", etiqueta: "Lo más nuevo" },
];

/**
 * Orden del catálogo.
 *
 * Es un `<select>` nativo a propósito. Un menú hecho a mano se ve más
 * bonito, pero el nativo abre la rueda del sistema en el celular —con
 * opciones enormes y el tamaño de letra que la persona tenga
 * configurado— y funciona con teclado y lector de pantalla sin que
 * tengamos que reimplementar nada. Para una clienta de más de 40 años en
 * un celular, eso gana a cualquier menú a medida.
 *
 * Ordenar por precio existía en el código pero no había ningún control
 * para usarlo: solo se llegaba escribiendo la dirección a mano.
 */
export function OrdenProductos({ actual }: { actual: OrdenCatalogo }) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendiente, iniciarTransicion] = useTransition();

  function cambiar(valor: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (valor && valor !== "destacados") nuevos.set("orden", valor);
    else nuevos.delete("orden");
    nuevos.delete("pagina");

    iniciarTransicion(() => {
      router.replace(nuevos.size ? `/?${nuevos}` : "/", { scroll: false });
    });
  }

  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="text-sm font-semibold text-carbon-suave">Ordenar</span>
      <select
        value={actual}
        onChange={(e) => cambiar(e.target.value)}
        disabled={pendiente}
        className="min-h-[48px] cursor-pointer rounded-pastilla border-2 border-lila-suave
                   bg-petalo px-4 text-sm font-semibold text-carbon outline-none
                   transition focus:border-fucsia disabled:opacity-60"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
