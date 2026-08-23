"use server";

import { revalidatePath } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoPedido } from "@/lib/types";

/**
 * Las acciones del panel usan la clave de servicio, que se salta las
 * reglas de seguridad. Por eso cada una comprueba primero que quien
 * llama tenga sesión iniciada.
 */
async function exigirSesion() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");
}

export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido) {
  await exigirSesion();
  const supabase = clienteAdmin();

  if (estado === "cancelado") {
    // Pasa por la función para que el stock vuelva al inventario.
    const { error } = await supabase.rpc("cancelar_pedido", { p_order_id: pedidoId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("orders").update({ estado }).eq("id", pedidoId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin");
}

export async function guardarNotaPedido(pedidoId: string, nota: string) {
  await exigirSesion();
  const supabase = clienteAdmin();

  const { error } = await supabase
    .from("orders")
    .update({ notas_admin: nota.trim() || null })
    .eq("id", pedidoId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
