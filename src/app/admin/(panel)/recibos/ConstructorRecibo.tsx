"use client";

import { useMemo } from "react";
import { CampoLista } from "@/components/admin/CamposPanel";
import { datosDePago } from "@/lib/admin/recibo";
import type { ReglaDescuento } from "@/lib/discounts";
import { pesos } from "@/lib/format";
import type { Pedido, Producto } from "@/lib/types";
import { AccionesRecibo } from "./AccionesRecibo";
import { DestinatarioRecibo } from "./DestinatarioRecibo";
import type { Modo } from "./estadoRecibo";
import { LineasRecibo } from "./LineasRecibo";
import { PersonalizarRecibo } from "./PersonalizarRecibo";
import { ResumenRecibo } from "./ResumenRecibo";
import { SeccionRecibo } from "./SeccionRecibo";
import { useRecibo } from "./useRecibo";
import { VistaPreviaRecibo } from "./VistaPreviaRecibo";

const MODOS: { modo: Modo; etiqueta: string }[] = [
  { modo: "pedido", etiqueta: "Desde un pedido" },
  { modo: "manual", etiqueta: "Recibo manual" },
];

export function ConstructorRecibo({
  pedidos,
  pedidoInicial = "",
  productos,
  reglas,
  umbralPorMayor,
  pagoMetodo,
  pagoNumero,
  pagoTitular,
  hoy,
  numeroInicial,
}: {
  pedidos: Pedido[];
  /** `?pedido=id` desde la tarjeta del pedido: llega ya elegido. */
  pedidoInicial?: string;
  productos: Producto[];
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
  pagoMetodo: string | null;
  pagoNumero: string | null;
  pagoTitular: string | null;
  /** AAAA-MM-DD en Bogotá y el número sugerido: vienen del servidor para que el HTML coincida al hidratar. */
  hoy: string;
  numeroInicial: string;
}) {
  const pago = useMemo(
    () => ({ metodo: pagoMetodo, numero: pagoNumero, titular: pagoTitular }),
    [pagoMetodo, pagoNumero, pagoTitular]
  );
  const { estado, despachar, recibo } = useRecibo(
    { pedidoId: pedidoInicial, hoy, numero: numeroInicial },
    { pedidos, productos, reglas, umbralPorMayor, pago }
  );
  const manual = estado.modo === "manual";
  const modo = manual ? estado.manual : estado.pedido;
  const { datos } = recibo;
  const listoParaArmar = manual || recibo.pedido !== null;
  const cuentaPago = datosDePago({ mostrarPago: true, pagoMetodo, pagoNumero, pagoTitular })?.cuenta ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <div className="min-w-0 space-y-5">
        <div role="group" aria-label="Tipo de recibo" className="grid grid-cols-2 gap-2">
          {MODOS.map(({ modo: m, etiqueta }) => (
            <button
              key={m}
              type="button"
              aria-pressed={estado.modo === m}
              onClick={() => despachar({ tipo: "modo", modo: m })}
              className={`min-h-11 cursor-pointer rounded-md border text-[15px] font-semibold ${
                estado.modo === m ? "border-tinta bg-tinta text-fondo" : "border-borde bg-fondo text-tinta hover:border-tinta"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {!manual && (
          <SeccionRecibo id="recibo-pedido" titulo="Pedido">
            <CampoLista
              id="recibo-elegir-pedido"
              etiqueta="Elige el pedido"
              value={estado.pedido.id}
              onChange={(e) => despachar({ tipo: "elegirPedido", id: e.target.value })}
            >
              <option value="">Selecciona un pedido…</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numeroPedido} · {p.clienteNombre} · {pesos(p.total)}
                </option>
              ))}
            </CampoLista>
          </SeccionRecibo>
        )}

        {listoParaArmar && (
          <>
            <DestinatarioRecibo
              destinatario={datos.destinatario}
              desdePedido={!manual}
              editado={recibo.destinatarioEditado}
              alCambiar={(campo, valor) =>
                despachar({ tipo: "destinatario", campo, valor, base: recibo.destinatarioBase })
              }
              alRestaurar={() => despachar({ tipo: "restaurarDestinatario" })}
            />
            <LineasRecibo
              manual={manual}
              productos={productos}
              lineas={recibo.lineasCatalogo}
              lineasTexto={modo.lineasTexto}
              alAgregarCatalogo={(linea) => despachar({ tipo: "agregarCatalogo", linea })}
              alCambiarCantidad={(productoId, tonoId, cantidad) =>
                despachar({ tipo: "cantidadCatalogo", productoId, tonoId, cantidad })
              }
              alCambiarPrecio={(clave, valor) => despachar({ tipo: "precio", clave, valor })}
              alGuardarTexto={(linea) => despachar({ tipo: "guardarTexto", linea })}
              alQuitarTexto={(id) => despachar({ tipo: "quitarTexto", id })}
            />
            <ResumenRecibo
              subtotal={datos.subtotal}
              descuento={recibo.descuentoAplicado}
              descuentoCalculado={recibo.descuentoCalculado}
              mostrarDescuento={recibo.mostrarDescuento}
              porMayor={datos.porMayor}
              ahorroPorMayor={recibo.ahorroPorMayor}
              total={datos.total}
              hayCatalogo={recibo.lineasCatalogo.length > 0}
              hayTexto={modo.lineasTexto.length > 0}
              alCambiarDescuento={(valor) => despachar({ tipo: "descuento", valor })}
              alMostrarDescuento={(valor) => despachar({ tipo: "mostrarDescuento", valor })}
            />
          </>
        )}

        <PersonalizarRecibo
          preferencias={estado.preferencias}
          numero={datos.numero}
          fecha={estado.fecha}
          pago={cuentaPago}
          alCambiarPreferencias={(cambios) => despachar({ tipo: "preferencias", cambios })}
          alRestablecer={() => despachar({ tipo: "restablecerPreferencias" })}
          alCambiarNumero={(valor) => despachar({ tipo: "numero", valor })}
          alCambiarFecha={(valor) => despachar({ tipo: "fecha", valor })}
        />
      </div>

      {/* En escritorio la columna queda a la vista; la vista previa se desplaza dentro para no tapar los botones. */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-8">
        <div className="lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto">
          <VistaPreviaRecibo datos={datos} />
        </div>
        <AccionesRecibo datos={datos} falta={recibo.falta} />
      </div>
    </div>
  );
}
