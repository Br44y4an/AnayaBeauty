import { Esqueleto, EsqueletoGrilla } from "@/components/ui/Esqueleto";

const MARCO = "mx-auto w-full max-w-[1200px] px-4 md:px-6 xl:px-8";
const PESTANAS = ["w-10", "w-16", "w-24", "w-14", "w-28", "w-20"];

/** Misma forma que el catálogo (franja, campo, pestañas, barra y grilla): al llegar nada salta. */
export default function CargandoCatalogo() {
  return (
    <main aria-busy="true">
      <div className="h-[34px] bg-superficie md:h-9" aria-hidden="true" />
      <div className={`${MARCO} pb-3 pt-3 lg:hidden`}>
        <Esqueleto className="h-13 w-full rounded-md" />
      </div>
      <div className="sticky top-14 z-20 border-b border-linea bg-fondo" aria-hidden="true">
        <div className={`${MARCO} flex h-11 items-center gap-6 overflow-hidden`}>
          {PESTANAS.map((ancho, i) => (
            <Esqueleto key={i} className={`h-4 shrink-0 ${ancho}`} />
          ))}
        </div>
      </div>
      <div className={`${MARCO} pb-16`}>
        <div className="flex items-center justify-between pb-3 pt-5" aria-hidden="true">
          <div>
            <Esqueleto className="h-6 w-40" />
            <Esqueleto className="mt-1.5 h-4 w-24 sm:hidden" />
          </div>
          <Esqueleto className="h-5 w-40" />
        </div>
        <EsqueletoGrilla />
      </div>
    </main>
  );
}
