import "server-only";
import { cache } from "react";
import { clienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sesion";
import { inicioDelDiaBogota, kpisDelDia } from "@/lib/admin/pedidos";
import { filtroBusqueda } from "@/lib/data/busqueda";
import { falla } from "@/lib/data/errores";
import { esUuid } from "@/lib/ids";
import type { EstadoPedido, LineaPedido, Pedido } from "@/lib/types";

// Lecturas del panel con la clave de servicio: cada una exige primero una administradora.

const CAMPOS_PEDIDO = `
  id, numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad,
  subtotal, descuento, porcentaje_descuento, por_mayor,
  total, estado, notas_admin, notas_cliente, created_at,
  order_items ( id, referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad,
                precio_unitario_aplicado, subtotal )
`;

type FilaPedido = {
  id: string;
  numero_pedido: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  cliente_ciudad: string;
  subtotal: number | null;
  descuento: number | null;
  porcentaje_descuento: number | null;
  por_mayor: boolean | null;
  total: number;
  estado: EstadoPedido;
  notas_admin: string | null;
  notas_cliente: string | null;
  created_at: string;
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

const orden = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Juntas por producto y con los tonos como en la foto: así se empaca. */
function enOrden(a: LineaPedido, b: LineaPedido): number {
  return orden.compare(a.referencia, b.referencia) || orden.compare(a.tono ?? "", b.tono ?? "");
}

export function mapearPedido(fila: FilaPedido): Pedido {
  const descuento = fila.descuento ?? 0;
  return {
    id: fila.id,
    numeroPedido: fila.numero_pedido,
    clienteNombre: fila.cliente_nombre,
    clienteWhatsapp: fila.cliente_whatsapp,
    clienteCiudad: fila.cliente_ciudad,
    notasCliente: fila.notas_cliente?.trim() || null,
    // Los pedidos anteriores a la columna guardaron subtotal 0.
    subtotal: fila.subtotal || fila.total + descuento,
    descuento,
    porcentajeDescuento: fila.porcentaje_descuento ?? 0,
    porMayor: fila.por_mayor ?? false,
    total: fila.total,
    estado: fila.estado,
    notasAdmin: fila.notas_admin,
    creadoEn: fila.created_at,
    lineas: (fila.order_items ?? [])
      .map((l) => ({
        id: l.id,
        referencia: l.referencia_snapshot,
        nombre: l.nombre_snapshot,
        tono: l.tono_snapshot ?? null,
        cantidad: l.cantidad,
        precioUnitarioAplicado: l.precio_unitario_aplicado,
        subtotal: l.subtotal,
      }))
      .sort(enOrden),
  };
}

/** La lista trae los más recientes; para uno anterior se busca. */
export const LIMITE_PEDIDOS = 200;

export async function listarPedidos(filtro?: {
  estado?: EstadoPedido;
  busqueda?: string;
}): Promise<Pedido[]> {
  await exigirAdmin();

  let consulta = clienteAdmin()
    .from("orders")
    .select(CAMPOS_PEDIDO)
    .order("created_at", { ascending: false })
    .limit(LIMITE_PEDIDOS);

  if (filtro?.estado) consulta = consulta.eq("estado", filtro.estado);
  if (filtro?.busqueda?.trim()) {
    consulta = consulta.or(
      filtroBusqueda(filtro.busqueda, ["cliente_nombre", "numero_pedido", "cliente_whatsapp"])
    );
  }

  const { data, error } = await consulta.overrideTypes<FilaPedido[], { merge: false }>();
  if (error) falla("panel", "No se pudieron cargar los pedidos", error);
  return (data ?? []).map(mapearPedido);
}

/** Para `/admin/recibos?pedido=id` cuando el pedido no está entre los más recientes. */
export async function obtenerPedidoAdmin(id: string): Promise<Pedido | null> {
  await exigirAdmin();
  if (!esUuid(id)) return null;

  const { data, error } = await clienteAdmin()
    .from("orders")
    .select(CAMPOS_PEDIDO)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<FilaPedido, { merge: false }>();

  if (error) falla("panel", "No se pudo cargar el pedido", error);
  return data ? mapearPedido(data) : null;
}

/** Cifras del día en hora de Bogotá, sin importar el filtro de la lista. */
export async function obtenerResumenDelDia(): Promise<ReturnType<typeof kpisDelDia>> {
  await exigirAdmin();
  const ahora = new Date();

  const { data, error } = await clienteAdmin()
    .from("orders")
    .select("created_at, total, estado")
    .gte("created_at", inicioDelDiaBogota(ahora).toISOString())
    .overrideTypes<{ created_at: string; total: number; estado: EstadoPedido }[], { merge: false }>();

  if (error) falla("panel", "No se pudo calcular el resumen del día", error);
  return kpisDelDia(
    (data ?? []).map((f) => ({ creadoEn: f.created_at, total: f.total, estado: f.estado })),
    ahora
  );
}

/** Pedidos por atender: el contador de la navegación y del título de la pestaña. */
export const contarPedidosNuevos = cache(async (): Promise<number> => {
  await exigirAdmin();

  const { count, error } = await clienteAdmin()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("estado", "nuevo");

  if (error) falla("panel", "No se pudieron contar los pedidos nuevos", error);
  return count ?? 0;
});
