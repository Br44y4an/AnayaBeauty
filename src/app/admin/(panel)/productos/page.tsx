import Link from "next/link";
import Image from "next/image";
import { listarProductosAdmin } from "@/lib/data/admin-catalog";
import { precioUnitarioPara } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { Insignia } from "@/components/ui/Insignia";
import { IconoCorazon } from "@/components/ui/Iconos";
import { BotonEliminarProducto } from "./BotonEliminarProducto";

export const dynamic = "force-dynamic";

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const productos = await listarProductosAdmin(q);

  const agotados = productos.filter((p) => p.activo && p.stock === 0).length;
  const porAgotarse = productos.filter((p) => p.activo && p.stock > 0 && p.stock <= 5).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-carbon">Productos</h1>
          <p className="text-sm text-carbon-suave">
            {productos.length} en total
            {agotados > 0 && ` · ${agotados} agotados`}
            {porAgotarse > 0 && ` · ${porAgotarse} por agotarse`}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/productos/importar"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-pastilla
                       border-2 border-fucsia-suave px-5 text-sm font-semibold text-fucsia
                       transition hover:border-fucsia"
          >
            Importar CSV
          </Link>

          <Link
            href="/admin/productos/nuevo"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-pastilla
                       bg-fucsia px-5 text-sm font-semibold text-petalo transition
                       hover:brightness-110"
          >
            Nuevo producto
          </Link>
        </div>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por referencia o nombre…"
          className="min-h-[44px] flex-1 rounded-pastilla border-2 border-lila-suave
                     bg-petalo px-4 text-sm outline-none transition focus:border-fucsia"
        />
        <button className="min-h-[44px] cursor-pointer rounded-pastilla bg-fucsia px-5
                           text-sm font-semibold text-petalo">
          Buscar
        </button>
      </form>

      {productos.length === 0 ? (
        <p className="py-16 text-center text-carbon-suave">
          No hay productos todavía. Crea el primero o importa tu lista por CSV.
        </p>
      ) : (
        <ul className="space-y-2">
          {productos.map((p) => (
            <li
              key={p.id}
              className="relative flex items-center gap-3 rounded-tarjeta bg-petalo p-3
                         shadow-petalo transition duration-200 hover:shadow-flotante"
            >
              {/* El enlace cubre toda la fila; el botón de eliminar va por encima */}
              <Link
                href={`/admin/productos/${p.id}`}
                aria-label={`Editar ${p.nombre}`}
                className="absolute inset-0 cursor-pointer rounded-tarjeta
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-fucsia"
              />

              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
                {p.imagenPrincipal ? (
                  <Image
                    src={p.imagenPrincipal}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-lila-suave">
                    <IconoCorazon className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-lila">{p.referencia}</p>
                <p className="truncate text-sm font-semibold text-carbon">{p.nombre}</p>
                <p className="text-xs text-carbon-suave">
                  {p.categoriaNombre ?? "Sin categoría"}
                  {p.escalones.length > 0 &&
                    ` · ${pesos(precioUnitarioPara(p.escalones, 1))} c/u`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {!p.activo ? (
                  <Insignia>Oculto</Insignia>
                ) : p.stock === 0 ? (
                  <Insignia tono="alerta">Agotado</Insignia>
                ) : p.stock <= 5 ? (
                  <Insignia tono="alerta">Quedan {p.stock}</Insignia>
                ) : (
                  <span className="text-sm font-semibold text-carbon">{p.stock}</span>
                )}
              </div>

              <div className="relative z-10 shrink-0">
                <BotonEliminarProducto id={p.id} nombre={p.nombre} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
