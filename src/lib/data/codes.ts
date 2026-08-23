import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Codigo } from "@/lib/types";

export async function listarCodigos(): Promise<Codigo[]> {
  const supabase = clienteAdmin();

  const { data, error } = await supabase
    .from("access_codes")
    .select("id, code, estado, vence_en, created_at, usado_en, nota, orders!access_codes_order_fk ( numero_pedido )")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`No se pudieron cargar los códigos: ${error.message}`);

  return (data ?? []).map((c) => {
    const pedido = Array.isArray(c.orders) ? c.orders[0] : c.orders;
    return {
      id: c.id,
      code: c.code,
      estado: c.estado,
      venceEn: c.vence_en,
      creadoEn: c.created_at,
      usadoEn: c.usado_en,
      numeroPedido: pedido?.numero_pedido ?? null,
      nota: c.nota,
    };
  });
}
