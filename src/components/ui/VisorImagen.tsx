"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { IconoCorazon } from "@/components/ui/Iconos";

/**
 * Visor de imagen a pantalla completa.
 *
 * Se cierra con Escape, con el botón, o tocando el fondo. Mientras está
 * abierto bloquea el desplazamiento de la página detrás, para que en
 * celular el pellizco haga zoom sobre la imagen y no mueva el catálogo.
 *
 * "Tocar fuera" cierra comparando contra el elemento real: antes el
 * `stopPropagation` vivía en un div del tamaño de toda la pantalla
 * (`fill` + `object-contain`), y ese div —no la foto— era quien recibía
 * el toque en el espacio vacío alrededor de una imagen que no llena el
 * recuadro. En un iPhone, donde ese recuadro invisible ocupa casi toda
 * la pantalla, "tocar fuera" casi nunca encontraba fondo real. Ahora la
 * imagen se dimensiona a su tamaño real (sin `fill`) y el
 * `stopPropagation` vive en ella misma, así que todo lo que no son sus
 * píxeles visibles sí es fondo y cierra.
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
  const [estado, setEstado] = useState<"cargando" | "lista" | "error">("cargando");

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

      {/* Reserva el espacio y avisa "ya casi" — una pantalla en blanco
          mientras carga se lee como que el visor se trabó. */}
      {estado === "cargando" && (
        <Esqueleto
          className="absolute left-1/2 top-1/2 aspect-square w-[70vw] max-w-sm
                     -translate-x-1/2 -translate-y-1/2"
        />
      )}

      {estado === "error" ? (
        <div className="flex flex-col items-center gap-2 text-petalo/80">
          <IconoCorazon className="h-16 w-16" />
          <p className="text-sm">No se pudo cargar la imagen.</p>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={1200}
          sizes="(max-width: 768px) 100vw, 768px"
          preload
          onClick={(e) => e.stopPropagation()}
          onLoad={() => setEstado("lista")}
          onError={() => setEstado("error")}
          className={`h-auto max-h-[85vh] w-auto max-w-full transition-opacity duration-200
                      ${estado === "lista" ? "opacity-100" : "opacity-0"}`}
        />
      )}

      <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-petalo/80">
        Toca fuera de la imagen para cerrar
      </p>
    </div>
  );
}
