import { urlSitio } from "@/lib/sitio";
import { GeneradorQR } from "./GeneradorQR";

export default function PaginaQR() {
  // `o=qr` marca el origen: las visitas que llegan escaneando el código.
  const url = `${urlSitio()}/?o=qr`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Código QR</h1>
        <p className="text-[15px] leading-6 text-tinta-suave">
          Muéstralo en los lives o imprímelo: al escanearlo, la clienta entra directo al catálogo.
        </p>
      </header>

      <GeneradorQR url={url} />

      <section aria-labelledby="consejos-titulo" className="space-y-2 rounded-md bg-superficie px-4 py-4">
        <h2 id="consejos-titulo" className="text-[15px] font-semibold leading-5 text-tinta">
          Para que se lea a la primera
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-tinta">
          <li>Muéstralo grande y quieto unos segundos: el celular necesita enfocar.</li>
          <li>Impreso, que mida al menos 5 cm de lado.</li>
          <li>Di la dirección en voz alta por si alguien no alcanza a escanear.</li>
        </ul>
      </section>
    </div>
  );
}
