import Image from "next/image";
import Link from "next/link";
import { useId, type MouseEvent } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { pesos } from "@/lib/format";
import { rutaProducto, urlCatalogo } from "@/lib/rutas";
import { pluralVariante } from "@/lib/variantes";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { SugerenciaProducto } from "@/lib/types";

export type Departamento = { nombre: string; slug: string };
/** Recibe el toque de un enlace de la búsqueda: la hoja cierra primero y luego navega. */
export type AlTocarEnlace = (evento: MouseEvent<HTMLAnchorElement>, scroll: boolean) => void;

/** Lo que se ve antes de escribir: cómo buscar y, si existen, los departamentos. */
export function AccesosBusqueda({
  departamentos,
  alTocar,
}: {
  departamentos: Departamento[];
  alTocar: AlTocarEnlace;
}) {
  const idTitulo = useId();

  return (
    <>
      <p className="text-[15px] leading-5 text-tinta-suave">
        Busca por nombre, como “brillo labial”, o por la referencia que viste en el live.
      </p>
      {departamentos.length > 0 && (
        <section aria-labelledby={idTitulo} className="mt-6">
          <h2 id={idTitulo} className="text-[15px] font-semibold leading-5 text-tinta">
            Departamentos
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {departamentos.map((d) => (
              <li key={d.slug}>
                <Link
                  href={urlCatalogo({ categoria: d.slug })}
                  onClick={(e) => alTocar(e, true)}
                  className="inline-flex min-h-11 items-center rounded-md border border-borde px-4 text-[15px] text-tinta
                             transition-colors duration-150 hover:border-tinta"
                >
                  {d.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function SugerenciasBusqueda({
  texto,
  total,
  productos,
  alTocar,
}: {
  texto: string;
  total: number;
  productos: SugerenciaProducto[];
  alTocar: AlTocarEnlace;
}) {
  return (
    <>
      <ul aria-label="Sugerencias" className="divide-y divide-linea">
        {productos.map((p) => (
          <FilaSugerencia key={p.referencia} producto={p} alTocar={(e) => alTocar(e, false)} />
        ))}
      </ul>
      <Link
        href={urlCatalogo({ q: texto })}
        onClick={(e) => alTocar(e, true)}
        className={estilosBoton({ variante: "secundario", ancho: true, className: "mt-3" })}
      >
        {total === 1 ? "Ver el resultado" : `Ver los ${total} resultados`}
      </Link>
    </>
  );
}

export function SinResultados({ texto, whatsapp }: { texto: string; whatsapp: string }) {
  return (
    <div className="mt-2">
      <p className="text-base font-semibold text-tinta">No encontramos “{texto}”</p>
      <p className="mt-1 text-[15px] leading-5 text-tinta-suave">Prueba con la referencia o escríbenos por WhatsApp.</p>
      <a
        href={enlaceWhatsApp(`Hola, busco “${texto}” y no lo encuentro en el catálogo.`, whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className={estilosBoton({ variante: "secundario", tamano: "compacto", className: "mt-4" })}
      >
        <IconoWhatsApp tamano={20} />
        Escríbenos por WhatsApp
      </a>
    </div>
  );
}

function FilaSugerencia({
  producto,
  alTocar,
}: {
  producto: SugerenciaProducto;
  alTocar: (evento: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const variantes = producto.numVariantes > 1 ? ` · ${pluralVariante(producto.etiquetaVariante, producto.numVariantes)}` : "";

  return (
    <li>
      <Link
        href={rutaProducto(producto.referencia)}
        onClick={alTocar}
        className="-mx-2 flex min-h-18 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-superficie"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-sm bg-superficie">
          {producto.imagenPrincipal && (
            <Image
              src={producto.imagenPrincipal}
              alt=""
              width={56}
              height={56}
              sizes="56px"
              className="size-[88%] object-contain mix-blend-multiply"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] font-medium leading-5 text-tinta">{producto.nombre}</span>
          <span className="mt-0.5 block text-[13px] leading-[18px] text-tinta-suave">
            Ref. {producto.referencia}
            {variantes}
          </span>
        </span>
        {producto.precioBase !== null && (
          <span className="shrink-0 text-[15px] font-semibold text-tinta tabular-nums">{pesos(producto.precioBase)}</span>
        )}
      </Link>
    </li>
  );
}
