import type { Metadata } from "next";
import { BarraResultados } from "@/components/catalogo/BarraResultados";
import { CampoBusqueda } from "@/components/catalogo/CampoBusqueda";
import { ChipsSubcategorias } from "@/components/catalogo/ChipsSubcategorias";
import { EstadoVacio } from "@/components/catalogo/EstadoVacio";
import { ListaProductos } from "@/components/catalogo/ListaProductos";
import { PestanasDepartamentos } from "@/components/catalogo/PestanasDepartamentos";
import { RielDestacados } from "@/components/catalogo/RielDestacados";
import { BarraBeneficios } from "@/components/tienda/BarraBeneficios";
import { arbolDeCategorias, type Departamento } from "@/lib/categorias";
import { obtenerCategorias, obtenerDestacados, obtenerProductos } from "@/lib/data/catalogo";
import { obtenerConfiguracionDePrecios, obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { ordenDeParametro } from "@/lib/rutas";
import type { Categoria } from "@/lib/types";

type Parametros = Promise<Record<string, string | string[] | undefined>>;

// El mismo marco que la cabecera: el logo, las pestañas y la grilla empiezan en la misma línea.
const MARCO = "mx-auto w-full max-w-[1200px] px-4 md:px-6 xl:px-8";

function texto(valor: string | string[] | undefined): string | null {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() || null;
}

function leerFiltros(p: Awaited<Parametros>) {
  return {
    q: texto(p.q)?.slice(0, 80) ?? null,
    categoria: texto(p.categoria),
    orden: ordenDeParametro(texto(p.orden)),
    pagina: Number(texto(p.pagina)) || 1,
  };
}

function titulo(q: string | null, elegida: Categoria | null): string {
  if (q) return elegida ? `Resultados para “${q}” en ${elegida.nombre}` : `Resultados para “${q}”`;
  return elegida?.nombre ?? "Todo el catálogo";
}

export async function generateMetadata({ searchParams }: { searchParams: Parametros }): Promise<Metadata> {
  const { q, categoria } = leerFiltros(await searchParams);
  if (q) return { title: `Resultados para “${q}”`, robots: { index: false } };
  if (!categoria) return {};
  const elegida = (await obtenerCategorias()).find((c) => c.slug === categoria);
  return elegida ? { title: elegida.nombre } : {};
}

export default async function PaginaCatalogo({ searchParams }: { searchParams: Parametros }) {
  const filtros = leerFiltros(await searchParams);
  const sinFiltros = !filtros.q && !filtros.categoria;

  const [resultado, categorias, precios, destacados] = await Promise.all([
    obtenerProductos({
      categoriaSlug: filtros.categoria,
      busqueda: filtros.q,
      orden: filtros.orden,
      pagina: filtros.pagina,
      hastaPagina: true,
    }),
    obtenerCategorias(),
    obtenerConfiguracionDePrecios(),
    sinFiltros ? obtenerDestacados(12) : Promise.resolve([]),
  ]);

  const departamentos = arbolDeCategorias(categorias);
  const elegida = categorias.find((c) => c.slug === filtros.categoria) ?? null;
  const departamento: Departamento | null = elegida
    ? (departamentos.find((d) => d.id === elegida.id || d.hijas.some((h) => h.id === elegida.id)) ?? null)
    : null;
  const vacio = resultado.productos.length === 0;
  // Solo el estado vacío necesita el WhatsApp: el resto del catálogo no depende de la configuración.
  const whatsapp = vacio ? (await obtenerConfiguracionPublica()).whatsappNegocio : "";

  return (
    <main>
      <BarraBeneficios reglas={precios.reglas} umbralPorMayor={precios.umbralPorMayor} />
      <div className={`${MARCO} pb-3 pt-3 lg:hidden`}>
        <CampoBusqueda texto={filtros.q ?? ""} />
      </div>

      <a href="#resultados" className="salto-contenido">
        Saltar a los productos
      </a>
      <PestanasDepartamentos
        departamentos={departamentos.map(({ id, nombre, slug }) => ({ id, nombre, slug }))}
        activo={departamento?.slug ?? null}
        orden={filtros.orden}
        hayBusqueda={Boolean(filtros.q)}
      />

      <div className={`${MARCO} pb-16`}>
        {departamento && filtros.categoria && (
          <ChipsSubcategorias departamento={departamento} activa={filtros.categoria} orden={filtros.orden} />
        )}
        {vacio ? (
          <EstadoVacio
            busqueda={filtros.q}
            categoriaInexistente={Boolean(filtros.categoria) && !elegida}
            departamentos={departamentos}
            whatsapp={whatsapp}
          />
        ) : (
          <>
            <BarraResultados
              titulo={titulo(filtros.q, elegida)}
              total={resultado.total}
              categoria={filtros.categoria}
              q={filtros.q}
              orden={filtros.orden}
            />
            {sinFiltros && <RielDestacados productos={destacados} />}
            <ListaProductos
              key={`${filtros.q ?? ""}|${filtros.categoria ?? ""}|${filtros.orden}`}
              inicial={resultado.productos}
              total={resultado.total}
              pagina={resultado.pagina}
              filtros={{ categoria: filtros.categoria, q: filtros.q, orden: filtros.orden }}
            />
          </>
        )}
      </div>
    </main>
  );
}
