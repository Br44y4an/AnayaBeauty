import Link from "next/link";
import { listarPedidos } from "@/lib/data/orders";
import { TablaPedidos } from "./TablaPedidos";
import { pesos } from "@/lib/format";
import type { EstadoPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTROS: (EstadoPedido | "todos")[] = [
  "todos",
  "nuevo",
  "pagado",
  "enviado",
  "cancelado",
];

export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const filtros = await searchParams;

  const estado =
    filtros.estado && filtros.estado !== "todos"
      ? (filtros.estado as EstadoPedido)
      : undefined;

  const pedidos = await listarPedidos({
    estado,
    busqueda: filtros.q,
  });

  const hoy = new Date().toDateString();
  const pedidosDeHoy = pedidos.filter(
    (p) => p.estado !== "cancelado" && new Date(p.creadoEn).toDateString() === hoy
  );
  const ventasDelDia = pedidosDeHoy.reduce((suma, p) => suma + p.total, 0);
  const porCobrar = pedidos
    .filter((p) => p.estado === "nuevo")
    .reduce((suma, p) => suma + p.total, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta titulo="Pedidos hoy" valor={String(pedidosDeHoy.length)} />
        <Tarjeta titulo="Ventas hoy" valor={pesos(ventasDelDia)} destacado />
        <Tarjeta
          titulo="Sin confirmar pago"
          valor={pesos(porCobrar)}
        />
        <Tarjeta titulo="Total en lista" valor={String(pedidos.length)} />
      </div>

      <form className="flex gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          name="q"
          defaultValue={filtros.q ?? ""}
          placeholder="Buscar por nombre, número o WhatsApp…"
          className="min-h-[44px] flex-1 rounded-pastilla border-2 border-lila-suave
                     bg-petalo px-4 text-sm outline-none transition focus:border-fucsia"
        />
        <button
          className="min-h-[44px] cursor-pointer rounded-pastilla bg-fucsia px-5
                     text-sm font-semibold text-petalo transition hover:brightness-110"
        >
          Buscar
        </button>
      </form>

      <nav className="flex gap-2 overflow-x-auto">
        {FILTROS.map((f) => {
          const activo = (filtros.estado ?? "todos") === f;
          const href =
            f === "todos"
              ? filtros.q
                ? `/admin?q=${encodeURIComponent(filtros.q)}`
                : "/admin"
              : `/admin?estado=${f}${filtros.q ? `&q=${encodeURIComponent(filtros.q)}` : ""}`;

          return (
            <Link
              key={f}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={`inline-flex min-h-[44px] cursor-pointer items-center whitespace-nowrap
                rounded-pastilla px-4 text-sm font-semibold capitalize transition duration-200
                ${activo ? "bg-fucsia text-petalo" : "bg-petalo text-carbon-suave hover:text-fucsia"}`}
            >
              {f}
            </Link>
          );
        })}
      </nav>

      <TablaPedidos pedidos={pedidos} />
    </div>
  );
}

function Tarjeta({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
      <p className="text-xs text-carbon-suave">{titulo}</p>
      <p
        className={`pt-1 font-display text-xl ${destacado ? "text-fucsia" : "text-carbon"}`}
      >
        {valor}
      </p>
    </div>
  );
}
