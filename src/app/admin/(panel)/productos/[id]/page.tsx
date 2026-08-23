import { notFound } from "next/navigation";
import { obtenerProductoAdmin, listarCategoriasAdmin } from "@/lib/data/admin-catalog";
import { FormularioProducto } from "../FormularioProducto";

export const dynamic = "force-dynamic";

export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const esNuevo = id === "nuevo";

  const [producto, categorias] = await Promise.all([
    esNuevo ? Promise.resolve(null) : obtenerProductoAdmin(id),
    listarCategoriasAdmin(),
  ]);

  if (!esNuevo && !producto) notFound();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl text-carbon">
        {esNuevo ? "Nuevo producto" : producto!.nombre}
      </h1>

      <FormularioProducto producto={producto ?? undefined} categorias={categorias} />
    </div>
  );
}
