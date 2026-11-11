"use client";

import Image from "next/image";
import { useState } from "react";
import { VisorImagen } from "@/components/ui/VisorImagen";
import { IconoMas } from "@/components/ui/Iconos";

type Props = {
  src: string | null;
  alt: string;
  /** Solo en la página completa, donde la foto es lo más grande de la primera pantalla. */
  prioridad?: boolean;
};

// La foto es la leyenda de los tonos: va completa (object-contain) y a todo el ancho, nunca recortada
// en cuadrado. La caja es 4:3 porque así son casi todas las fotos (~500×380); un toque la amplía.
export function FotoProducto({ src, alt, prioridad = false }: Props) {
  const [ampliada, setAmpliada] = useState(false);

  if (!src) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-superficie text-[15px] text-tinta-suave md:rounded-md">
        Sin foto
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label={`Ampliar foto de ${alt}`}
        className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-superficie md:rounded-md"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw"
          {...(prioridad ? { preload: true } : { loading: "eager" as const, fetchPriority: "high" as const })}
          className="object-contain p-[3%] mix-blend-multiply"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex h-8 items-center gap-1 rounded-full bg-fondo pl-2 pr-3 text-[13px]
                     font-semibold text-tinta ring-1 ring-linea"
        >
          <IconoMas tamano={16} />
          Ampliar
        </span>
      </button>
      <VisorImagen src={src} alt={alt} abierto={ampliada} alCerrar={() => setAmpliada(false)} />
    </>
  );
}
