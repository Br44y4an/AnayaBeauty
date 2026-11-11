import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { contarPedidosNuevos, LIMITE_PEDIDOS, listarPedidos, obtenerResumenDelDia } from "@/lib/data/orders";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { estadoDeParametro } from "@/lib/admin/pedidos";
import { pesos } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import type { EstadoPedido } from "@/lib/types";
import { IndicadorEnVivo } from "./PedidosEnVivo";
import { TablaPedidos } from "./TablaPedidos";

export const dynamic = "force-dynamic";

const FILTROS: { estado?: EstadoPedido; texto: string }[] = [
  { texto: "Todos" },
  { estado: "nuevo", texto: "Nuevos" },
  { estado: "pagado", texto: "Pagados" },
  { estado: "enviado", texto: "Enviados" },
  { estado: "cancelado", texto: "Cancelados" },
];

type Parametros = Record<string, string | string[] | undefined>;

function texto(valor: string | string[] | undefined): string {
  return (typeof valor === "string" ? valor : "").trim().slice(0, 80);
}

function urlPedidos(estado: EstadoPedido | undefined, q: string): string {
  const parametros = new URLSearchParams();
  if (estado) parametros.set("estado", estado);
  if (q) parametros.set("q", q);
  const consulta = parametros.toString();
  return consulta ? `/admin?${consulta}` : "/admin";
}

export const metadata: Metadata = { title: "Pedidos" };

export default async function PaginaPedidos({ searchParams }: { searchParams: Promise<Parametros> }) {
  const parametros = await searchParams;
  const estado = estadoDeParametro(texto(parametros.estado));
  const q = texto(parametros.q);

  const [pedidos, hoy, configuracion] = await Promise.all([
    listarPedidos({ estado, busqueda: q }),
    obtenerResumenDelDia(),
    obtenerConfiguracionPublica(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Pedidos</h1>
        <IndicadorEnVivo />
      </header>

      <section aria-labelledby="resumen-hoy">
        <h2 id="resumen-hoy" className="sr-only">
          Hoy
        </h2>
        <dl className="grid grid-cols-3 divide-x divide-linea rounded-md border border-linea">
          <Cifra etiqueta="Pedidos hoy" valor={String(hoy.pedidos)} />
          <Cifra etiqueta="Vendido hoy" valor={pesos(hoy.vendido)} />
          <Cifra etiqueta="Por cobrar hoy" valor={pesos(hoy.porCobrar)} />
        </dl>
      </section>

      <Form action="/admin" className="flex items-end gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <Campo
          id="buscar-pedidos"
          name="q"
          type="search"
          etiqueta="Buscar"
          ayuda="Por nombre, número de pedido o WhatsApp"
          defaultValue={q}
          enterKeyHint="search"
          className="min-w-0 flex-1"
        />
        <Boton type="submit" variante="secundario" tamano="compacto" className="h-12">
          Buscar
        </Boton>
      </Form>

      <nav aria-label="Filtrar por estado" className="-mx-4 -my-1 overflow-x-auto px-4 py-1">
        <ul className="flex gap-2">
          {FILTROS.map((f) => {
            const activo = f.estado === estado;
            return (
              <li key={f.texto} className="shrink-0">
                <Link
                  href={urlPedidos(f.estado, q)}
                  aria-current={activo ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-md border px-3.5 text-[15px] font-medium ${
                    activo ? "border-tinta bg-tinta text-fondo" : "border-linea text-tinta hover:border-borde"
                  }`}
                >
                  {f.texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {pedidos.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-base text-tinta-suave">
            {q ? `No encontramos pedidos para «${q}».` : "No hay pedidos con este filtro."}
          </p>
          {(q || estado) && (
            <Link href="/admin" className="mt-3 inline-flex min-h-11 items-center font-semibold text-tinta underline underline-offset-2">
              Ver todos los pedidos
            </Link>
          )}
        </div>
      ) : (
        <TablaPedidos pedidos={pedidos} pago={configuracion.pago} />
      )}

      {pedidos.length === LIMITE_PEDIDOS && (
        <p className="text-center text-sm text-tinta-suave">
          Se ven los {LIMITE_PEDIDOS} más recientes. Busca por número o nombre para encontrar uno anterior.
        </p>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0 px-2 py-3 sm:px-4">
      <dt className="text-[13px] leading-[18px] text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-bold leading-[22px] tabular-nums text-tinta sm:text-[17px]">{valor}</dd>
    </div>
  );
}
