import Form from "next/form";
import Link from "next/link";
import { listarCategoriasAdmin, listarProductosAdmin, type CategoriaPanel } from "@/lib/data/admin-catalog";
import {
  contarPorFiltro,
  estadoLista,
  filtrarProductosAdmin,
  FILTROS_PRODUCTOS,
  SIN_CATEGORIA,
  urlEditarProducto,
  urlListaProductos,
  type EstadoLista,
} from "@/lib/admin/filtros";
import { arbolDeCategorias } from "@/lib/categorias";
import { rutaProducto } from "@/lib/rutas";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { CampoLista } from "@/components/admin/CamposPanel";
import { AvisoLista } from "./AvisoLista";
import { FilaProducto } from "./FilaProducto";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const lista = estadoLista(parametros);
  const [productos, categorias] = await Promise.all([
    listarProductosAdmin(lista.q, { variantes: false }),
    listarCategoriasAdmin(),
  ]);

  const cuenta = contarPorFiltro(productos, lista.categoria, categorias);
  const filtrados = filtrarProductosAdmin(productos, lista.filtro, lista.categoria, categorias);
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pagina = Math.min(lista.pagina, paginas);
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const enPagina = { ...lista, pagina };

  const guardado = typeof parametros.guardado === "string" ? productos.find((p) => p.id === parametros.guardado) : null;
  const eliminado = typeof parametros.eliminado === "string" ? parametros.eliminado.slice(0, 40) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Productos</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {cuenta.todos} en total
            {cuenta.agotados > 0 && ` · ${cuenta.agotados} ${cuenta.agotados === 1 ? "agotado" : "agotados"}`}
            {cuenta.ocultos > 0 && ` · ${cuenta.ocultos} ${cuenta.ocultos === 1 ? "oculto" : "ocultos"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonEnlace href="/admin/productos/importar" variante="contorno" tamano="compacto">
            Importar CSV
          </BotonEnlace>
          <BotonEnlace href={urlEditarProducto("nuevo", enPagina)} tamano="compacto">
            Nuevo producto
          </BotonEnlace>
        </div>
      </div>

      {guardado && (
        <AvisoLista parametro="guardado">
          Guardaste <strong className="font-semibold">{guardado.nombre}</strong>.{" "}
          {guardado.activo && (
            <a
              href={rutaProducto(guardado.referencia)}
              target="_blank"
              rel="noopener"
              className="font-semibold underline underline-offset-2"
            >
              Ver en la tienda
            </a>
          )}
        </AvisoLista>
      )}
      {eliminado && <AvisoLista parametro="eliminado">Eliminaste el producto Ref. {eliminado}.</AvisoLista>}

      <Form action="/admin/productos" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] sm:items-end">
        <Campo
          id="buscar-productos"
          name="q"
          type="search"
          etiqueta="Buscar por referencia o nombre"
          defaultValue={lista.q}
          enterKeyHint="search"
        />
        <div className="flex items-end gap-3 sm:contents">
          <CampoLista
            id="categoria-productos"
            name="categoria"
            etiqueta="Categoría"
            defaultValue={lista.categoria}
            className="min-w-0 flex-1"
          >
            <OpcionesCategoria categorias={categorias} />
          </CampoLista>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </div>
        {lista.filtro !== "todos" && <input type="hidden" name="filtro" value={lista.filtro} />}
      </Form>

      <nav aria-label="Filtrar productos" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTROS_PRODUCTOS.map((f) => {
            const activo = f.valor === lista.filtro;
            return (
              <li key={f.valor} className="shrink-0">
                <Link
                  href={urlListaProductos({ ...lista, filtro: f.valor, pagina: 1 })}
                  aria-current={activo ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3.5 text-[15px] font-medium ${
                    activo ? "border-tinta bg-tinta text-fondo" : "border-linea text-tinta hover:border-borde"
                  }`}
                >
                  {f.etiqueta}
                  <span className={`tabular-nums ${activo ? "" : "text-tinta-suave"}`}>{cuenta[f.valor]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-tinta-suave">
          {productos.length === 0 && !lista.q
            ? "Aún no hay productos. Crea el primero o importa tu lista en CSV."
            : "No hay productos con estos filtros."}
        </p>
      ) : (
        <ul className="divide-y divide-linea border-y border-linea">
          {visibles.map((p) => (
            <FilaProducto key={p.id} producto={p} href={urlEditarProducto(p.id, enPagina)} />
          ))}
        </ul>
      )}

      {paginas > 1 && <Paginacion lista={enPagina} paginas={paginas} total={filtrados.length} />}
    </div>
  );
}

function OpcionesCategoria({ categorias }: { categorias: CategoriaPanel[] }) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const nombre = (id: string, texto: string) => `${texto}${porId.get(id)?.activo === false ? " (oculta)" : ""}`;

  return (
    <>
      <option value="">Todas</option>
      <option value={SIN_CATEGORIA}>Sin categoría</option>
      {arbolDeCategorias(categorias).map((d) =>
        d.hijas.length === 0 ? (
          <option key={d.id} value={d.id}>
            {nombre(d.id, d.nombre)}
          </option>
        ) : (
          <optgroup key={d.id} label={d.nombre}>
            <option value={d.id}>{nombre(d.id, `Todo ${d.nombre}`)}</option>
            {d.hijas.map((h) => (
              <option key={h.id} value={h.id}>
                {nombre(h.id, h.nombre)}
              </option>
            ))}
          </optgroup>
        )
      )}
    </>
  );
}

function Paginacion({ lista, paginas, total }: { lista: EstadoLista; paginas: number; total: number }) {
  const desde = (lista.pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(total, lista.pagina * POR_PAGINA);

  return (
    <nav aria-label="Páginas de productos" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-tinta-suave">
        Del {desde} al {hasta} de {total}
      </p>
      <div className="flex gap-2">
        {lista.pagina > 1 && (
          <BotonEnlace
            href={urlListaProductos({ ...lista, pagina: lista.pagina - 1 })}
            variante="contorno"
            tamano="compacto"
          >
            Anteriores
          </BotonEnlace>
        )}
        {lista.pagina < paginas && (
          <BotonEnlace
            href={urlListaProductos({ ...lista, pagina: lista.pagina + 1 })}
            variante="contorno"
            tamano="compacto"
          >
            Siguientes
          </BotonEnlace>
        )}
      </div>
    </nav>
  );
}
