import Link from "next/link";
import { ImportadorCSV } from "./ImportadorCSV";
import { IconoFlechaIzquierda } from "@/components/ui/Iconos";

export default function PaginaImportar() {
  return (
    <div className="space-y-5">
      <Link
        href="/admin/productos"
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-sm
                   font-semibold text-lila transition hover:text-fucsia"
      >
        <IconoFlechaIzquierda className="h-4 w-4" />
        Volver a productos
      </Link>

      <h1 className="font-display text-2xl text-carbon">Importar productos</h1>

      <ImportadorCSV />
    </div>
  );
}
