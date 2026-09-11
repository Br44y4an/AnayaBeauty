import { listarCategoriasAdmin } from "@/lib/data/admin-catalog";
import { guardarCategoria, eliminarCategoria } from "../productos/actions";
import { Boton } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

const CAMPO =
  "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-2.5 " +
  "outline-none transition focus:border-fucsia";

export default async function PaginaCategorias() {
  const categorias = await listarCategoriasAdmin();
  const principales = categorias.filter((c) => c.categoriaPadreId === null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-carbon">Categorías</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Organizan el catálogo. Puedes crear subcategorías eligiendo una categoría madre.
        </p>
      </div>

      <form
        action={guardarCategoria}
        className="grid gap-3 rounded-tarjeta bg-petalo p-5 shadow-petalo sm:grid-cols-4"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-carbon">Nombre</span>
          <input name="nombre" required placeholder="Labiales" className={CAMPO} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Dentro de</span>
          <select name="categoria_padre_id" className={CAMPO} defaultValue="">
            <option value="">Categoría principal</option>
            {principales.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Orden</span>
          <input name="orden" type="number" defaultValue={0} className={CAMPO} />
        </label>

        <div className="sm:col-span-4">
          <Boton type="submit">Agregar categoría</Boton>
        </div>
      </form>

      {categorias.length === 0 ? (
        <p className="py-10 text-center text-carbon-suave">
          Aún no hay categorías. Crea la primera arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {principales.map((c) => {
            const hijas = categorias.filter((h) => h.categoriaPadreId === c.id);

            return (
              <li key={c.id} className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
                <FilaCategoria categoria={c} />

                {hijas.length > 0 && (
                  <ul className="mt-2 space-y-2 border-l-2 border-lila-suave pl-4">
                    {hijas.map((h) => (
                      <li key={h.id}>
                        <FilaCategoria categoria={h} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilaCategoria({
  categoria,
}: {
  categoria: { id: string; nombre: string; slug: string; orden: number };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-carbon">{categoria.nombre}</p>
        <p className="text-xs text-carbon-suave">
          /{categoria.slug} · orden {categoria.orden}
        </p>
      </div>

      <form action={eliminarCategoria.bind(null, categoria.id)}>
        <button className="min-h-[44px] cursor-pointer px-2 text-xs text-carbon-suave
                           underline transition hover:text-fucsia">
          Ocultar
        </button>
      </form>
    </div>
  );
}
