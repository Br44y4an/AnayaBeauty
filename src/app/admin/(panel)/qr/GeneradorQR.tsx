"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Boton } from "@/components/ui/Boton";
import { PALETA } from "@/lib/marca";

type Estado = "creando" | "listo" | "error";

/** Módulos en tinta sobre blanco: el mayor contraste posible, también en una transmisión con poca definición. */
export function GeneradorQR({ url }: { url: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [estado, setEstado] = useState<Estado>("creando");

  useEffect(() => {
    if (!lienzo.current) return;
    QRCode.toCanvas(lienzo.current, url, {
      width: 1024,
      margin: 2,
      color: { dark: PALETA.tinta, light: PALETA.fondo },
      // Corrección alta: se sigue leyendo aunque se imprima pequeño o se vea borroso en el live.
      errorCorrectionLevel: "H",
    })
      .then(() => setEstado("listo"))
      .catch(() => setEstado("error"));
  }, [url]);

  function descargar() {
    if (!lienzo.current) return;
    const enlace = document.createElement("a");
    enlace.download = "anaya-beauty-qr.png";
    enlace.href = lienzo.current.toDataURL("image/png");
    enlace.click();
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="border border-linea bg-fondo p-4">
        <canvas
          ref={lienzo}
          role="img"
          aria-label={`Código QR que abre ${url}`}
          className="block size-64 sm:size-72"
        />
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center break-all text-[15px] text-tinta underline underline-offset-2"
      >
        {url}
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>

      {estado === "error" && (
        <p role="alert" className="text-sm leading-5 text-error">
          No se pudo crear el código. Recarga la página.
        </p>
      )}
      <Boton type="button" onClick={descargar} disabled={estado !== "listo"}>
        Descargar en alta resolución
      </Boton>
    </div>
  );
}
