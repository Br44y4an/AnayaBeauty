import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Pedido, EstadoPedido } from "@/lib/types";

const CAMPOS_PEDIDO = `
  id, numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad,
  subtotal, descuento, porcentaje_descuento, por_mayor,
  total, estado, notas_admin, created_at,
  access_codes!orders_code_id_fkey ( code ),
  order_items ( id, referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad,
                precio_unitario_aplicado, subtotal )
`;

type FilaPedido = {
  id: string;
  numero_pedido: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  cliente_ciudad: string;
  subtotal: number;
  descuento: number;
  porcentaje_descuento: number;
  por_mayor: boolean;
  total: number;
  estado: EstadoPedido;
  notas_admin: string | null;
  created_at: string;
  access_codes: { code: string } | { code: string }[] | null;
  order_items:
    | {
        id: string;
        referencia_snapshot: string;
        nombre_snapshot: string;
        tono_snapshot: string | null;
        cantidad: number;
        precio_unitario_aplicado: number;
        subtotal: number;
      }[]
    | null;
};

function mapearPedido(fila: FilaPedido): Pedido {
  const codigo = Array.isArray(fila.access_codes) ? fila.access_codes[0] : fila.access_codes;

  return {
    id: fila.id,
    numeroPedido: fila.numero_pedido,
    clienteNombre: fila.cliente_nombre,
    clienteWhatsapp: fila.cliente_whatsapp,
    clienteCiudad: fila.cliente_ciudad,
    subtotal: fila.subtotal ?? fila.total,
    descuento: fila.descuento ?? 0,
    porcentajeDescuento: fila.porcentaje_descuento ?? 0,
    porMayor: fila.por_mayor ?? false,
    total: fila.total,
    estado: fila.estado,
    notasAdmin: fila.notas_admin,
    codigoUsado: codigo?.code ?? null,
    creadoEn: fila.created_at,
    lineas: (fila.order_items ?? []).map((l) => ({
      id: l.id,
      referencia: l.referencia_snapshot,
      nombre: l.nombre_snapshot,
      tono: l.tono_snapshot ?? null,
      cantidad: l.cantidad,
      precioUnitarioAplicado: l.precio_unitario_aplicado,
      subtotal: l.subtotal,
    })),
  };
}

export async function obtenerPedidoPorId(id: string): Promise<Pedido | null> {
  // El identificador es impredecible: sirve como llave de acceso a la
  // pantalla de éxito sin exponer los pedidos de otras clientas.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const supabase = clienteAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(CAMPOS_PEDIDO)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapearPedido(data as unknown as FilaPedido);
}

export async function listarPedidos(filtro?: {
  estado?: EstadoPedido;
  busqueda?: string;
}): Promise<Pedido[]> {
  const supabase = clienteAdmin();

  let consulta = supabase
    .from("orders")
    .select(CAMPOS_PEDIDO)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtro?.estado) consulta = consulta.eq("estado", filtro.estado);

  if (filtro?.busqueda?.trim()) {
    const t = `%${filtro.busqueda.trim()}%`;
    consulta = consulta.or(
      `cliente_nombre.ilike.${t},numero_pedido.ilike.${t},cliente_whatsapp.ilike.${t}`
    );
  }

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  return (data as unknown as FilaPedido[]).map(mapearPedido);
}
