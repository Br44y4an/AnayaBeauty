"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { Marca } from "@/components/ui/Marca";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Red de seguridad de la web: reintenta sin recargar, recarga o lleva a WhatsApp. La bolsa no se pierde. */
export default function ErrorTienda({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[web] error no controlado:", error);
  }, [error]);

  const codigo = error.digest ? ` (código ${error.digest})` : "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Marca />
      <h1 className="mt-8 text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-tinta">Algo no cargó bien</h1>
      <p className="mt-2 text-base text-tinta-suave">Lo que tienes en tu bolsa sigue guardado.</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Boton type="button" ancho onClick={() => retry()}>
          Volver a intentar
        </Boton>
        <Boton type="button" variante="secundario" ancho onClick={() => window.location.reload()}>
          Recargar la página
        </Boton>
      </div>

      <a
        href={enlaceWhatsApp(`Hola, el catálogo me mostró un error${codigo}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-tinta underline underline-offset-4"
      >
        <IconoWhatsApp tamano={20} />
        Escríbenos por WhatsApp
      </a>

      {error.digest && (
        <p className="mt-6 text-[13px] leading-[18px] text-tinta-suave">Código del error: {error.digest}</p>
      )}
    </main>
  );
}
