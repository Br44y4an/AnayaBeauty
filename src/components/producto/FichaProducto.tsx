import type { Metadata } from "next";
import { BarraFicha } from "@/components/producto/BarraFicha";
import { FotoProducto } from "@/components/producto/FotoProducto";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { RielRelacionados } from "@/components/producto/RielRelacionados";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { obtenerProductoPorReferencia, obtenerRelacionados } from "@/lib/data/catalogo";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { pesos } from "@/lib/format";
import { decodificarReferencia } from "@/lib/rutas";
import type { Producto } from "@/lib/types";

type Variante = "modal" | "pagina";

const comparable = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** null si la descripción solo repite el nombre, con o sin «6 tonos» detrás (pasa en casi todo el catálogo). */
export function descripcionUtil({ nombre, descripcion }: Pick<Producto, "nombre" | "descripcion">): string | null {
  const texto = descripcion?.trim();
  if (!texto) return null;
  const [n, d] = [comparable(nombre), comparable(texto)];
  const resto = d.startsWith(n) ? d.slice(n.length).trim() : d;
  return resto === "" || /^\d+ [a-z]+$/.test(resto) ? null : texto;
}

/** Título y vista previa para el enlace que se comparte por WhatsApp. */
export async function metadataDeProducto(parametro: string): Promise<Metadata> {
  const referencia = decodificarReferencia(parametro);
  const producto = referencia ? await obtenerProductoPorReferencia(referencia) : null;
  if (!producto) return { title: "Producto no disponible" };

  const [unidad, siguiente] = producto.escalones;
  const precios = unidad
    ? ` ${pesos(unidad.precioUnitario)} c/u${siguiente ? `; ${siguiente.minCantidad} o más: ${pesos(siguiente.precioUnitario)} c/u` : ""}.`
    : "";
  return {
    title: producto.nombre,
    description: `${producto.nombre}.${precios} Ref. ${producto.referencia}. Pídelo en el catálogo de Anaya Beauty.`,
    openGraph: { title: producto.nombre, images: producto.imagenPrincipal ? [producto.imagenPrincipal] : [] },
  };
}

/** La ficha de un producto: la misma en la vista rápida y en la página completa. */
export async function FichaProducto({ producto, variante }: { producto: Producto; variante: Variante }) {
  // El riel y el número de WhatsApp son secundarios: si fallan, la ficha se muestra igual (ya quedó registrado).
  const [relacionados, configuracion] = await Promise.all([
    obtenerRelacionados(producto).catch(() => []),
    obtenerConfiguracionPublica().catch(() => null),
  ]);
  const enModal = variante === "modal";
  const Titulo = enModal ? "h2" : "h1";
  const Subtitulo = enModal ? "h3" : "h2";
  const descripcion = descripcionUtil(producto);

  return (
    <article aria-labelledby={`ficha-${variante}`}>
      <BarraFicha variante={variante} nombre={producto.nombre} referencia={producto.referencia} />
      {/* Foto 7/12 y compra 5/12. Con lista larga de variantes (la marca el selector, que solo existe si
          se puede comprar) la compra pasa a 7/12 para que la lista quepa en dos columnas. */}
      <div className="group/ficha md:grid md:grid-cols-2 md:items-start md:gap-x-8 lg:grid-cols-12 lg:gap-x-12">
        <div
          className={`-mx-4 md:sticky md:mx-0 lg:col-span-7 lg:group-has-[[data-lista-larga]]/ficha:col-span-5 ${
            enModal ? "md:top-15" : "md:top-20"
          }`}
        >
          <FotoProducto src={producto.imagenPrincipal} alt={producto.nombre} prioridad={!enModal} />
        </div>

        <div className="pt-5 md:pt-0 lg:col-span-5 lg:group-has-[[data-lista-larga]]/ficha:col-span-7">
          {producto.categoriaNombre && (
            <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-firma">
              {producto.categoriaNombre}
            </p>
          )}
          <Titulo
            id={`ficha-${variante}`}
            className="mt-1.5 text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-tinta lg:text-[32px] lg:leading-[38px]"
          >
            {producto.nombre}
          </Titulo>
          <p className="mt-2 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
            {`Ref. ${producto.referencia}`}
          </p>

          <div className="mt-6">
            <PanelCompra producto={producto} variante={variante} whatsapp={configuracion?.whatsappNegocio}>
              {descripcion && (
                <section className="mt-8">
                  <Subtitulo className="text-base font-semibold leading-6 text-tinta">Descripción</Subtitulo>
                  <p className="mt-1.5 whitespace-pre-line text-base leading-6 text-tinta">{descripcion}</p>
                </section>
              )}
            </PanelCompra>
          </div>
        </div>
      </div>

      <RielRelacionados
        productos={relacionados}
        titulo={`Más de ${producto.categoriaNombre ?? "la tienda"}`}
        enModal={enModal}
      />
    </article>
  );
}

/** Vista rápida mientras llegan los datos: misma forma que la ficha (barra, foto 4:3, textos, precio y filas). */
export function EsqueletoFicha() {
  return (
    <div role="status" aria-label="Cargando producto">
      <div className="-mx-4 -mt-4 h-15 border-b border-linea md:-mx-6 md:mb-4" />
      <div className="md:grid md:grid-cols-2 md:gap-x-8 lg:grid-cols-12 lg:gap-x-12">
        <Esqueleto className="-mx-4 aspect-[4/3] md:mx-0 md:rounded-md lg:col-span-7" />
        <div className="pt-5 md:pt-0 lg:col-span-5">
          <Esqueleto className="h-3.5 w-24" />
          <Esqueleto className="mt-3 h-8 w-4/5" />
          <Esqueleto className="mt-3 h-3.5 w-28" />
          <Esqueleto className="mt-7 h-8 w-32" />
          <Esqueleto className="mt-3 h-14 w-full rounded-md" />
          <Esqueleto className="mt-8 h-6 w-36" />
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="mt-3 h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
