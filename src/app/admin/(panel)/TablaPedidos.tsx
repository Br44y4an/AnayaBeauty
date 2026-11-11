"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { mostrarAviso } from "@/lib/avisos";
import { NOMBRE_ESTADO, SIN_CONEXION_ESTADO } from "@/lib/admin/pedidos";
import type { ConfiguracionPublica, EstadoPedido, Pedido } from "@/lib/types";
import { cambiarEstadoPedido } from "./acciones-pedidos";
import { useEnVivo } from "./PedidosEnVivo";
import { TarjetaPedido } from "./TarjetaPedido";

function textoHecho(destino: EstadoPedido, deshaciendo: boolean): string {
  if (deshaciendo) return `Volvió a ${NOMBRE_ESTADO[destino].toLocaleLowerCase("es")}`;
  if (destino === "pagado") return "Pago confirmado";
  if (destino === "enviado") return "Marcado como enviado";
  if (destino === "cancelado") return "Pedido cancelado";
  return `Quedó como ${NOMBRE_ESTADO[destino].toLocaleLowerCase("es")}`;
}

export function TablaPedidos({ pedidos, pago }: { pedidos: Pedido[]; pago: ConfiguracionPublica["pago"] }) {
  const { abiertoDesde } = useEnVivo();
  const [pendiente, iniciar] = useTransition();
  const [guardando, setGuardando] = useState<{ id: string; destino: EstadoPedido } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [porCancelar, setPorCancelar] = useState<Pedido | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // `deshaciendo`: las correcciones (pagado → nuevo, enviado → pagado) no ofrecen otro «Deshacer».
  function cambiar(p: Pick<Pedido, "id" | "numeroPedido" | "estado">, destino: EstadoPedido, deshaciendo = false) {
    setGuardando({ id: p.id, destino });
    setErrores(({ [p.id]: _, ...resto }) => resto);

    iniciar(async () => {
      // Sin red la acción rechaza («Failed to fetch»); un rechazo dentro de la transición subiría al
      // límite de error del panel y taparía la lista. El error se queda en la tarjeta.
      const resultado = (await cambiarEstadoPedido(p.id, destino).catch(() => null)) ?? {
        ok: false as const,
        error: SIN_CONEXION_ESTADO,
      };
      if (!resultado.ok) {
        setErrores((previos) => ({ ...previos, [p.id]: resultado.error }));
        return;
      }

      const previo = p.estado;
      mostrarAviso({
        titulo: textoHecho(destino, deshaciendo),
        detalle:
          destino === "cancelado"
            ? `${p.numeroPedido}. Las unidades volvieron al inventario.`
            : p.numeroPedido,
        accion:
          deshaciendo || destino === "cancelado"
            ? undefined
            : {
                etiqueta: "Deshacer",
                alHacer: () => cambiar({ ...p, estado: destino }, previo, true),
              },
      });
    });
  }

  function pedirCancelar(p: Pedido) {
    setPorCancelar(p);
    setConfirmando(true);
  }

  function confirmarCancelacion() {
    setConfirmando(false);
    if (porCancelar) cambiar(porCancelar, "cancelado");
  }

  const unidadesPorCancelar = porCancelar?.lineas.reduce((suma, l) => suma + l.cantidad, 0) ?? 0;

  return (
    <>
      <ul className="space-y-3">
        {pedidos.map((p) => (
          <li key={p.id}>
            <TarjetaPedido
              pedido={p}
              pago={pago}
              recienLlegado={p.estado === "nuevo" && Date.parse(p.creadoEn) > abiertoDesde}
              guardando={pendiente && guardando?.id === p.id ? guardando.destino : null}
              enEspera={pendiente && guardando?.id !== p.id}
              error={errores[p.id] ?? null}
              alCambiar={(destino) => cambiar(p, destino)}
              alPedirCancelar={() => pedirCancelar(p)}
            />
          </li>
        ))}
      </ul>

      <Hoja
        abierta={confirmando}
        alCerrar={() => setConfirmando(false)}
        titulo={`¿Cancelar el pedido ${porCancelar?.numeroPedido ?? ""}?`}
        pie={
          <div className="grid gap-2 sm:grid-cols-2">
            <Boton type="button" variante="peligro" onClick={confirmarCancelacion}>
              Sí, cancelar pedido
            </Boton>
            <Boton type="button" variante="secundario" data-autofocus onClick={() => setConfirmando(false)}>
              No, dejarlo así
            </Boton>
          </div>
        }
      >
        <p className="text-base leading-6 text-tinta">
          {unidadesPorCancelar === 1 ? "La unidad vuelve" : `Las ${unidadesPorCancelar} unidades vuelven`} al
          inventario y el pedido queda cerrado. No se puede deshacer.
        </p>
      </Hoja>
    </>
  );
}
