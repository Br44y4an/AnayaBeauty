import type { ReactNode } from "react";
import { BusquedaRapida } from "@/components/catalogo/BusquedaRapida";
import { Encabezado } from "@/components/tienda/Encabezado";
import { Pie } from "@/components/tienda/Pie";
import { SincronizarBolsa } from "@/components/tienda/SincronizarBolsa";
import { Avisos } from "@/components/ui/Avisos";
import { arbolDeCategorias } from "@/lib/categorias";
import { obtenerCategorias } from "@/lib/data/catalogo";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";

/** Marco de la tienda. Las páginas ponen su propio <main>; aquí solo va el destino del salto de contenido. */
export default async function LayoutTienda({ children }: { children: ReactNode }) {
  const [configuracion, categorias] = await Promise.all([obtenerConfiguracionPublica(), obtenerCategorias()]);
  // Accesos de la búsqueda: solo departamentos de verdad. Con la lista aún plana serían 26 botones.
  const departamentos = arbolDeCategorias(categorias)
    .filter((d) => d.hijas.length > 0)
    .map(({ nombre, slug }) => ({ nombre, slug }));
  const whatsapp = configuracion.whatsappNegocio;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>
      <Encabezado whatsapp={whatsapp} />
      <div id="contenido" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
      <Pie whatsapp={whatsapp} />
      <BusquedaRapida whatsapp={whatsapp} departamentos={departamentos} />
      <Avisos />
      <SincronizarBolsa />
    </div>
  );
}
