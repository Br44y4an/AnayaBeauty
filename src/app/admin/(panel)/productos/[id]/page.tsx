import Link from "next/link";
import { notFound } from "next/navigation";
import { listarCategoriasAdmin, obtenerProductoAdmin } from "@/lib/data/admin-catalog";
import { estadoLista, urlListaProductos } from "@/lib/admin/filtros";
import { rutaProducto } from "@/lib/rutas";
import { Insignia } from "@/components/ui/Insignia";
import { IconoAtras } from "@/components/ui/Iconos";
import { BotonEliminarProducto } from "../BotonEliminarProducto";
import { FormularioProducto } from "../FormularioProducto";

export const dynamic = "force-dynamic";

export default async function PaginaEditarProducto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);
  const lista = estadoLista(parametros);
  const esNuevo = id === "nuevo";

  const [producto, categorias] = await Promise.all([
    esNuevo ? Promise.resolve(null) : obtenerProductoAdmin(id),
    listarCategoriasAdmin(),
  ]);
  if (!esNuevo && !producto) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={urlListaProductos(lista)}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-semibold text-tinta hover:bg-superficie"
      >
        <IconoAtras tamano={20} />
        Productos
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">{producto?.nombre ?? "Nuevo producto"}</h1>
        {producto && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
              Ref. {producto.referencia}
            </span>
            {!producto.activo && <Insignia>Oculto</Insignia>}
            {producto.activo && (
              <a
                href={rutaProducto(producto.referencia)}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center text-[15px] font-semibold text-tinta underline underline-offset-2"
              >
                Ver en la tienda
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            )}
          </div>
        )}
      </header>

      <FormularioProducto producto={producto} categorias={categorias} lista={lista} />

      {producto && <BotonEliminarProducto id={producto.id} nombre={producto.nombre} lista={lista} />}
    </div>
  );
}
