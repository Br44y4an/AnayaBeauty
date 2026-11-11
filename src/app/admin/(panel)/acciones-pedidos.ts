"use server";

import { refresh } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sesion";
import { estadoDeParametro, mensajeErrorEstado } from "@/lib/admin/pedidos";
import type { Resultado } from "@/lib/admin/resultado";
import { invalidarCatalogo } from "@/lib/data/invalidar";
import { esUuid } from "@/lib/ids";
import type { EstadoPedido } from "@/lib/types";

/**
 * Solo pasa por `cambiar_estado_pedido`: valida la transición y, al cancelar, devuelve el stock una vez.
 * Repetir el estado actual (doble toque) no es error.
 */
export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido): Promise<Resultado> {
  await exigirAdmin();
  const destino = estadoDeParametro(estado);
  if (!esUuid(pedidoId) || !destino) return { ok: false, error: "Este pedido ya no existe." };

  const { error } = await clienteAdmin().rpc("cambiar_estado_pedido", {
    p_order_id: pedidoId,
    p_estado: destino,
  });

  if (error) {
    console.error("[panel] no se pudo cambiar el estado del pedido:", error);
    refresh();
    return { ok: false, error: mensajeErrorEstado(error) };
  }

  if (destino === "cancelado") invalidarCatalogo();
  refresh();
  return { ok: true };
}
