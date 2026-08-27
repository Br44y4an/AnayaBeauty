import { listarPedidos } from "@/lib/data/orders";
import {
  listarProductosAdmin,
  listarReglasDescuento,
  obtenerConfiguracion,
} from "@/lib/data/admin-catalog";
import { ConstructorRecibo } from "./ConstructorRecibo";

export const dynamic = "force-dynamic";

export default async function PaginaRecibos() {
  const [pedidos, productos, reglas, configuracion] = await Promise.all([
    listarPedidos(),
    listarProductosAdmin(),
    listarReglasDescuento(),
    obtenerConfiguracion(),
  ]);

  const valores = Object.fromEntries(configuracion.map((c) => [c.clave, c.valor]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-carbon">Recibos</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Arma un recibo desde un pedido ya confirmado o desde cero, y
          descárgalo en PDF para enviarlo por WhatsApp o imprimirlo.
        </p>
        <p className="pt-1 text-xs text-carbon-suave">
          El recibo manual solo genera el PDF: no descuenta stock ni crea un
          pedido en el sistema. Para eso, usa el código de acceso normal.
        </p>
      </div>

      <ConstructorRecibo
        pedidos={pedidos}
        productos={productos.filter((p) => p.escalones.length > 0)}
        reglas={reglas
          .filter((r) => r.activo)
          .map((r) => ({ montoMinimo: r.montoMinimo, porcentaje: r.porcentaje }))}
        umbralPorMayor={Number(valores.umbral_por_mayor ?? 200000)}
        pagoMetodo={valores.pago_metodo ?? null}
        pagoNumero={valores.pago_numero ?? null}
        pagoTitular={valores.pago_titular ?? null}
      />
    </div>
  );
}
