import type { Metadata } from "next";
import Link from "next/link";
import { listarPedidos, obtenerPedidoAdmin } from "@/lib/data/orders";
import { listarProductosAdmin, listarReglasDescuento, obtenerConfiguracion } from "@/lib/data/admin-catalog";
import { mapearConfiguracion } from "@/lib/data/configuracion";
import { esUuid } from "@/lib/ids";
import { IconoAtras } from "@/components/ui/Iconos";
import { ConstructorRecibo } from "./ConstructorRecibo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recibos" };

export default async function PaginaRecibos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { pedido: parametro } = await searchParams;
  const pedidoId = esUuid(parametro) ? parametro : null;

  const [pedidos, productos, reglas, configuracion] = await Promise.all([
    listarPedidos(),
    listarProductosAdmin(),
    listarReglasDescuento(),
    obtenerConfiguracion(),
  ]);

  // «Recibo» en una tarjeta de Pedidos llega con ?pedido=id, aunque sea anterior a los de la lista.
  const elegido = pedidoId ? (pedidos.find((p) => p.id === pedidoId) ?? (await obtenerPedidoAdmin(pedidoId))) : null;
  const opciones = elegido && !pedidos.includes(elegido) ? [elegido, ...pedidos] : pedidos;
  const ajustes = mapearConfiguracion(configuracion);

  return (
    <div className="space-y-6">
      {elegido && (
        <Link
          href="/admin"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-semibold text-tinta hover:bg-superficie"
        >
          <IconoAtras tamano={20} />
          Pedidos
        </Link>
      )}

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Recibos</h1>
        <p className="max-w-2xl text-[15px] leading-6 text-tinta-suave">
          Arma un recibo desde un pedido o desde cero y descárgalo en PDF para enviarlo por WhatsApp o imprimirlo.
          El recibo manual solo genera el PDF: no descuenta stock ni crea un pedido.
        </p>
      </header>

      <ConstructorRecibo
        pedidos={opciones}
        pedidoInicial={elegido?.id ?? ""}
        productos={productos.filter((p) => p.escalones.length > 0)}
        reglas={reglas
          .filter((r) => r.activo)
          .map((r) => ({ montoMinimo: r.montoMinimo, porcentaje: r.porcentaje }))}
        umbralPorMayor={ajustes.umbralPorMayor}
        pagoMetodo={ajustes.pago.metodo}
        pagoNumero={ajustes.pago.numero}
        pagoTitular={ajustes.pago.titular}
      />
    </div>
  );
}
