"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoAtras, IconoCompartir } from "@/components/ui/Iconos";
import { mostrarAviso } from "@/lib/avisos";

type Props = { variante: "modal" | "pagina"; nombre: string; referencia: string };

const COMPARTIR = estilosBoton({ variante: "fantasma", tamano: "compacto", className: "px-3" });

/** Quien llegó a la ficha desde la tienda vuelve a donde estaba; quien llegó de WhatsApp, al inicio. */
function vieneDeLaTienda(): boolean {
  try {
    return window.history.length > 1 && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function copiarEnlace(nombre: string, url: string) {
  try {
    await navigator.clipboard.writeText(url);
    mostrarAviso({ titulo: "Enlace copiado", detalle: nombre });
  } catch {
    mostrarAviso({ titulo: "No pudimos copiar el enlace", detalle: url });
  }
}

/** Fila superior: «Volver al catálogo» en la página completa y «Compartir» en las dos vistas. */
export function BarraFicha({ variante, nombre, referencia }: Props) {
  const router = useRouter();

  function volver(evento: MouseEvent<HTMLAnchorElement>) {
    if (!vieneDeLaTienda()) return;
    evento.preventDefault();
    router.back();
  }

  async function compartir() {
    const url = window.location.href;
    if (typeof navigator.share !== "function") return copiarEnlace(nombre, url);
    try {
      await navigator.share({ title: nombre, text: `${nombre} · Ref. ${referencia}`, url });
    } catch (error) {
      if ((error as Error | null)?.name !== "AbortError") await copiarEnlace(nombre, url);
    }
  }

  const botonCompartir = (
    <button type="button" onClick={compartir} className={COMPARTIR}>
      <IconoCompartir tamano={20} />
      Compartir
    </button>
  );

  // En la vista rápida es la barra fija de la hoja: su botón Cerrar flota encima, a la derecha de Compartir.
  // -top-4 y -mt-4 anulan el relleno superior del panel para que se pegue al borde.
  if (variante === "modal") {
    return (
      <div
        className="sticky -top-4 z-[5] -mx-4 -mt-4 flex justify-end border-b border-linea bg-fondo py-2 pr-15
                   md:-mx-6 md:mb-4"
      >
        {botonCompartir}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Link
        href="/"
        onClick={volver}
        className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-semibold leading-5
                   text-tinta hover:bg-superficie"
      >
        <IconoAtras tamano={20} />
        Volver al catálogo
      </Link>
      {botonCompartir}
    </div>
  );
}
