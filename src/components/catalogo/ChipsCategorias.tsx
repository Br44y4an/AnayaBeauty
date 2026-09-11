import Link from "next/link";
import type { Categoria } from "@/lib/types";

/**
 * Filtros por categoría.
 *
 * Se muestran las principales en una fila que se desliza. Si la clienta
 * entra en una que tiene subcategorías, aparece una segunda fila con
 * ellas: antes las subcategorías existían en los datos pero no había
 * forma de llegar a ellas desde la web, así que una tienda con 591
 * productos solo se podía filtrar en bloques enormes.
 *
 * Los chips son enlaces de verdad (no botones con JavaScript): funcionan
 * con el botón atrás, se pueden abrir en otra pestaña y se pueden
 * compartir por WhatsApp, que es como circula este catálogo.
 */
export function ChipsCategorias({
  categorias,
  activa,
  parametros,
}: {
  categorias: Categoria[];
  activa?: string;
  /** El resto de filtros, para no perderlos al cambiar de categoría. */
  parametros: Record<string, string | undefined>;
}) {
  const principales = categorias.filter((c) => c.categoriaPadreId === null);

  const laActiva = categorias.find((c) => c.slug === activa) ?? null;
  const padreDeLaActiva = laActiva?.categoriaPadreId
    ? (categorias.find((c) => c.id === laActiva.categoriaPadreId) ?? null)
    : laActiva;

  const hermanas = padreDeLaActiva
    ? categorias.filter((c) => c.categoriaPadreId === padreDeLaActiva.id)
    : [];

  /** Conserva búsqueda y orden; la categoría manda; la página se reinicia. */
  function enlace(slug?: string): string {
    const query = new URLSearchParams();
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor && clave !== "categoria" && clave !== "pagina") query.set(clave, valor);
    }
    if (slug) query.set("categoria", slug);
    return query.size ? `/?${query}` : "/";
  }

  return (
    <div className="space-y-2">
      <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Chip href={enlace()} activo={!activa}>
              Todo
            </Chip>
          </li>
          {principales.map((c) => (
            <li key={c.id}>
              <Chip
                href={enlace(c.slug)}
                activo={activa === c.slug || padreDeLaActiva?.id === c.id}
              >
                {c.nombre}
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      {hermanas.length > 0 && (
        <nav
          aria-label={`Dentro de ${padreDeLaActiva?.nombre}`}
          className="-mx-4 overflow-x-auto px-4"
        >
          <ul className="flex gap-2 pb-1">
            <li>
              <Chip
                href={enlace(padreDeLaActiva!.slug)}
                activo={activa === padreDeLaActiva!.slug}
                secundario
              >
                Todo en {padreDeLaActiva!.nombre}
              </Chip>
            </li>
            {hermanas.map((c) => (
              <li key={c.id}>
                <Chip href={enlace(c.slug)} activo={activa === c.slug} secundario>
                  {c.nombre}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function Chip({
  href,
  activo,
  secundario,
  children,
}: {
  href: string;
  activo: boolean;
  secundario?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex cursor-pointer items-center whitespace-nowrap rounded-pastilla " +
    "font-semibold transition duration-200";

  const tamano = secundario
    ? "min-h-[44px] px-3.5 text-sm"
    : "min-h-[48px] px-5 text-[15px]";

  const color = activo
    ? "bg-fucsia text-petalo shadow-petalo"
    : secundario
      ? "bg-petalo text-carbon-suave hover:text-fucsia-texto"
      : "bg-petalo text-carbon hover:text-fucsia-texto";

  return (
    <Link href={href} aria-current={activo ? "page" : undefined} className={`${base} ${tamano} ${color}`}>
      {children}
    </Link>
  );
}
