import { GeneradorQR } from "./GeneradorQR";

export default function PaginaQR() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-carbon">Código QR</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Este es el código que muestras en las transmisiones. Al escanearlo, la
          clienta entra directo al catálogo.
        </p>
      </div>

      <GeneradorQR url={url} />

      <div className="mx-auto max-w-md space-y-2 rounded-tarjeta bg-petalo p-5 shadow-petalo">
        <p className="text-sm font-semibold text-carbon">Consejos para el live</p>
        <ul className="space-y-1 text-sm text-carbon-suave">
          <li>• Muéstralo grande y quieto unos segundos: los celulares necesitan enfocar.</li>
          <li>• Imprímelo y pégalo en un cartón para tenerlo siempre a mano.</li>
          <li>• Repite la dirección en voz alta por si alguien no alcanza a escanear.</li>
        </ul>
      </div>
    </div>
  );
}
