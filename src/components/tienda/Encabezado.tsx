import { BotonBuscar, CampoBusqueda } from "@/components/catalogo/CampoBusqueda";
import { BotonBolsa } from "@/components/tienda/BotonBolsa";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { Marca } from "@/components/ui/Marca";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Cabecera fija de 56 px (borde incluido): las pestañas de departamentos se pegan justo debajo (top-14). */
export function Encabezado({ whatsapp }: { whatsapp: string }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-linea bg-fondo">
      <div className="mx-auto flex h-full max-w-[1200px] items-center px-4 md:px-6 xl:px-8">
        <Marca />
        <div className="ml-8 hidden w-[420px] lg:block">
          <CampoBusqueda compacto />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <BotonBuscar className="lg:hidden" />
          <a
            href={enlaceWhatsApp("Hola, vengo del catálogo.", whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escríbenos por WhatsApp"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2.5 text-[15px]
                       font-semibold leading-5 text-tinta transition-colors duration-150 hover:bg-superficie"
          >
            <IconoWhatsApp />
            <span className="hidden lg:inline">Escríbenos</span>
          </a>
          <BotonBolsa />
        </div>
      </div>
    </header>
  );
}
