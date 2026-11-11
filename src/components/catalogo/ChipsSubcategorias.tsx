import Link from "next/link";
import { urlCatalogo } from "@/lib/rutas";
import type { Departamento } from "@/lib/categorias";
import type { OrdenCatalogo } from "@/lib/types";

type Props = {
  departamento: Pick<Departamento, "nombre" | "slug" | "hijas">;
  /** Slug elegido en la URL: el del departamento («Todo en …») o el de una hija. */
  activa: string;
  orden: OrdenCatalogo;
};

/** Segunda fila, solo dentro de un departamento con hijas: «Todo en Labios», «Lip gloss»… */
export function ChipsSubcategorias({ departamento, activa, orden }: Props) {
  if (departamento.hijas.length === 0) return null;

  const chips = [
    { slug: departamento.slug, nombre: `Todo en ${departamento.nombre}` },
    ...departamento.hijas.map((h) => ({ slug: h.slug, nombre: h.nombre })),
  ];

  return (
    <nav
      aria-label={`Subcategorías de ${departamento.nombre}`}
      className="-mx-4 overflow-x-auto [scrollbar-width:none] md:mx-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-2 px-4 pt-4 md:flex-wrap md:px-0">
        {chips.map((chip) => (
          <li key={chip.slug} className="shrink-0">
            <Link
              href={urlCatalogo({ categoria: chip.slug, orden })}
              scroll={false}
              aria-current={chip.slug === activa ? "page" : undefined}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md border border-borde px-3.5
                         text-sm font-medium leading-5 text-tinta transition-colors duration-150 hover:border-tinta
                         focus-visible:-outline-offset-2 aria-[current=page]:border-tinta aria-[current=page]:bg-tinta
                         aria-[current=page]:text-fondo"
            >
              {chip.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
