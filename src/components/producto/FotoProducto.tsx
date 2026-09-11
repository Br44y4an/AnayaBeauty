"use client";

import Image from "next/image";
import { useState } from "react";
import { VisorImagen } from "@/components/ui/VisorImagen";
import { IconoCorazon, IconoLupa } from "@/components/ui/Iconos";

/**
 * Foto principal del detalle, ampliable.
 *
 * En maquillaje la foto decide la compra: hay que poder acercarse a ver
 * el color de verdad. En la tarjeta del catálogo esto ya existía; en el
 * detalle, que es donde la clienta está decidiendo, la imagen no se
 * podía abrir.
 */
export function FotoProducto({ src, alt }: { src: string | null; alt: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!src) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-tarjeta
                      bg-petalo text-lila-suave shadow-petalo">
        <IconoCorazon className="h-20 w-20" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ver la foto de ${alt} en grande`}
        className="group relative aspect-square w-full cursor-pointer overflow-hidden
                   rounded-tarjeta bg-petalo shadow-petalo"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center
                     rounded-full bg-petalo/90 text-carbon shadow-petalo
                     transition group-hover:bg-petalo"
        >
          <IconoLupa className="h-5 w-5" />
        </span>
      </button>

      {abierto && <VisorImagen src={src} alt={alt} alCerrar={() => setAbierto(false)} />}
    </>
  );
}
