import { Esqueleto } from "@/components/ui/Esqueleto";

/** Carga propia del panel: sin ella se veía el esqueleto del catálogo de la tienda. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-6">
      <Esqueleto className="h-[30px] w-40" />
      <Esqueleto className="h-[72px] w-full rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-md border border-linea p-4">
            <div className="flex justify-between gap-4">
              <Esqueleto className="h-5 w-24" />
              <Esqueleto className="h-5 w-16" />
            </div>
            <Esqueleto className="h-4 w-1/2" />
            <Esqueleto className="h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
