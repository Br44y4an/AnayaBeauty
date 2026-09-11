"use client";

import { useEffect } from "react";
import { enlaceWhatsApp } from "@/lib/format";

/**
 * Red de seguridad de toda la web pública.
 *
 * Sin este archivo cualquier fallo del servidor (una consulta que
 * revienta, Supabase caído) dejaba una pantalla en blanco con el texto
 * "Minified React error #441" — la clienta no entendía nada y se perdía
 * la venta. Aquí siempre hay un mensaje claro, un botón para reintentar
 * sin recargar, y una salida por WhatsApp.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[web] error no controlado:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-fucsia-suave/40 text-4xl">
        🌸
      </span>

      <h1 className="font-display text-3xl text-carbon">Algo se nos enredó</h1>

      <p className="text-carbon-suave">
        No pudimos cargar esta pantalla. Tu pedido sigue guardado en tu bolsa:
        no perdiste nada.
      </p>

      <button
        onClick={reset}
        className="min-h-[52px] w-full cursor-pointer rounded-pastilla bg-fucsia px-6
                   text-lg font-semibold text-petalo shadow-petalo transition
                   duration-200 hover:brightness-110 active:scale-[0.98]"
      >
        Intentar de nuevo
      </button>

      <a
        href="/"
        className="min-h-[52px] w-full cursor-pointer rounded-pastilla border-2
                   border-fucsia-suave px-6 py-3.5 text-lg font-semibold
                   text-fucsia-texto transition duration-200 hover:border-fucsia"
      >
        Volver al catálogo
      </a>

      <a
        href={enlaceWhatsApp("Hola, la página me mostró un error 🥲")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-carbon-suave underline
                   underline-offset-4 transition hover:text-fucsia-texto"
      >
        Escribirnos por WhatsApp
      </a>

      {error.digest && (
        <p className="text-xs text-carbon-suave">Referencia: {error.digest}</p>
      )}
    </main>
  );
}
