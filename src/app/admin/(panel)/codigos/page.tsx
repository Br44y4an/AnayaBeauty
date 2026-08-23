import { listarCodigos } from "@/lib/data/codes";
import { PanelCodigos } from "./PanelCodigos";

export const dynamic = "force-dynamic";

export default async function PaginaCodigos() {
  const codigos = await listarCodigos();
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-carbon">Códigos</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Genera un código cuando confirmes que la clienta te transfirió. El mensaje
          ya trae el link que aplica el código solo, sin que ella tenga que escribirlo.
        </p>
      </div>

      <PanelCodigos codigos={codigos} sitio={sitio} />
    </div>
  );
}
