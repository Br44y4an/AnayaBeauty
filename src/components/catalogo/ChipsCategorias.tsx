import Link from "next/link";
import type { Categoria } from "@/lib/types";

export function ChipsCategorias({
  categorias,
  activa,
  busqueda,
}: {
  categorias: Categoria[];
  activa?: string;
  busqueda?: string;
}) {
  const principales = categorias.filter((c) => c.categoriaPadreId === null);

  // Conservar la búsqueda al cambiar de categoría
  const sufijo = busqueda ? `&q=${encodeURIComponent(busqueda)}` : "";
  const inicio = busqueda ? `/?q=${encodeURIComponent(busqueda)}` : "/";

  return (
    <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        <li>
          <Chip href={inicio} activo={!activa}>
            Todo
          </Chip>
        </li>
        {principales.map((c) => (
          <li key={c.id}>
            <Chip href={`/?categoria=${c.slug}${sufijo}`} activo={activa === c.slug}>
              {c.nombre}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`inline-flex min-h-[40px] cursor-pointer items-center whitespace-nowrap
        rounded-pastilla px-4 text-sm font-semibold transition duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia
        ${
          activo
            ? "bg-fucsia text-petalo shadow-petalo"
            : "bg-petalo text-carbon-suave hover:text-fucsia"
        }`}
    >
      {children}
    </Link>
  );
}
