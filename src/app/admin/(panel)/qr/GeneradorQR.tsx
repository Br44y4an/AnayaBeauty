"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Boton } from "@/components/ui/Boton";

export function GeneradorQR({ url }: { url: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!lienzo.current || !url) return;

    QRCode.toCanvas(lienzo.current, url, {
      width: 1024,
      margin: 2,
      color: { dark: "#E5308A", light: "#FFFFFF" },
      // Corrección alta: el QR sigue leyéndose aunque se imprima
      // pequeño o se vea en una transmisión con poca definición.
      errorCorrectionLevel: "H",
    })
      .then(() => setListo(true))
      .catch(() => setListo(false));
  }, [url]);

  function descargar() {
    if (!lienzo.current) return;

    const enlace = document.createElement("a");
    enlace.download = "anaya-beauty-qr.png";
    enlace.href = lienzo.current.toDataURL("image/png");
    enlace.click();
  }

  return (
    <div className="space-y-4 text-center">
      <div className="inline-block rounded-tarjeta bg-petalo p-6 shadow-petalo">
        <canvas ref={lienzo} className="h-64 w-64" />
      </div>

      <p className="break-all text-sm text-carbon-suave">{url}</p>

      <Boton onClick={descargar} disabled={!listo}>
        Descargar QR en alta resolución
      </Boton>
    </div>
  );
}
