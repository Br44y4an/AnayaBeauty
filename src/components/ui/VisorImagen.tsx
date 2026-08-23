"use client";

import { useEffect } from "react";
import Image from "next/image";

/**
 * Visor de imagen a pantalla completa.
 *
 * Se cierra con Escape, con el botón, o tocando el fondo. Mientras está
 * abierto bloquea el desplazamiento de la página detrás, para que en
 * celular el pellizco haga zoom sobre la imagen y no mueva el catálogo.
 */
export function VisorImagen({
  src,
  alt,
  alCerrar,
}: {
  src: string;
  alt: string;
  alCerrar: () => void;
}) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    document.addEventListener("keydown", alPulsar);

    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = desbordeOriginal;
    };
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={alCerrar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon/90 p-4
                 animate-[aparecer_0.2s_ease]"
    >
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar la imagen"
        className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center
                   justify-center rounded-full bg-petalo/95 text-2xl leading-none
                   text-carbon shadow-flotante transition hover:bg-petalo
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia"
      >
        ×
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative h-full max-h-[85vh] w-full max-w-3xl"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          quality={100}
          priority
          className="object-contain"
        />
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-petalo/80">
        Toca fuera de la imagen para cerrar
      </p>
    </div>
  );
}
