import Link from "next/link";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { urlCatalogo } from "@/lib/rutas";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Categoria } from "@/lib/types";

const SUGERENCIAS = 8;

type Props = {
  busqueda: string | null;
  /** El slug de la URL no existe (enlace viejo o categoría ocultada). */
  categoriaInexistente: boolean;
  departamentos: Pick<Categoria, "id" | "nombre" | "slug">[];
  whatsapp: string;
};

function titulo(busqueda: string | null, categoriaInexistente: boolean): string {
  if (busqueda) return `No encontramos productos para “${busqueda}”`;
  return categoriaInexistente ? "Esta categoría ya no está disponible" : "Aquí todavía no hay productos";
}

/** Sin resultados: qué probar y a quién escribir, nunca una pantalla en blanco. Hace de título de la página. */
export function EstadoVacio({ busqueda, categoriaInexistente, departamentos, whatsapp }: Props) {
  const mensaje = busqueda
    ? `Hola, estoy buscando ${busqueda} y no lo encuentro en el catálogo.`
    : "Hola, tengo una pregunta sobre el catálogo.";

  return (
    <section id="resultados" aria-labelledby="titulo-vacio" className="mx-auto max-w-md py-12 text-center">
      <h1 id="titulo-vacio" className="text-xl font-semibold leading-[26px] text-tinta">
        {titulo(busqueda, categoriaInexistente)}
      </h1>
      <p className="mt-2 text-base leading-6 text-tinta-suave">
        {busqueda
          ? "Prueba con una sola palabra o con la referencia, o mira por departamento."
          : "Mira otro departamento."}
      </p>

      {departamentos.length > 0 && (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {departamentos.slice(0, SUGERENCIAS).map((d) => (
            <li key={d.id}>
              <Link
                href={urlCatalogo({ categoria: d.slug })}
                className="inline-flex min-h-11 items-center rounded-md border border-borde px-3.5 text-sm
                           font-medium leading-5 text-tinta transition-colors duration-150 hover:border-tinta"
              >
                {d.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <a
        href={enlaceWhatsApp(mensaje, whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className={estilosBoton({ variante: "secundario", className: "mt-8" })}
      >
        <IconoWhatsApp tamano={20} />
        Escríbenos por WhatsApp
      </a>
    </section>
  );
}
