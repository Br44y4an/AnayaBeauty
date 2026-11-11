import { listarCategoriasAdmin } from "@/lib/data/admin-catalog";
import { EditorCategorias } from "./EditorCategorias";

export const dynamic = "force-dynamic";

export default async function PaginaCategorias() {
  const categorias = await listarCategoriasAdmin();
  const ocultas = categorias.filter((c) => !c.activo).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Categorías</h1>
        <p className="text-[15px] leading-6 text-tinta-suave">
          {categorias.length} en total{ocultas > 0 && ` · ${ocultas} ${ocultas === 1 ? "oculta" : "ocultas"}`}. El
          orden de esta lista es el de la tienda: los departamentos salen como pestañas y sus categorías como filtros.
        </p>
        <p className="text-[15px] leading-6 text-tinta-suave">
          Ocultar una categoría la saca de las pestañas, pero sus productos siguen en «Todo» y en la búsqueda. Para
          sacarlos de la tienda, ocúltalos en Productos.
        </p>
      </header>

      <EditorCategorias categorias={categorias} />
    </div>
  );
}
