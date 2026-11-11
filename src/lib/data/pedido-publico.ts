import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import { esUuid } from "@/lib/ids";
import type { EstadoPedido, LineaPedido, Pedido } from "@/lib/types";

// Solo lo que la clienta ya conoce de su pedido: nada de notas internas, IP ni claves.
const CAMPOS = `
  id, numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad, notas_cliente,
  subtotal, descuento, porcentaje_descuento, por_mayor, total, estado, created_at,
  order_items ( id, referencia_snapshot, nombre_snapshot, tono_snapshot, cantidad, precio_unitario_aplicado, subtotal )
`;

type FilaLinea = {
  id: string;
  referencia_snapshot: string;
  nombre_snapshot: string;
  tono_snapshot: string | null;
  cantidad: number;
  precio_unitario_aplicado: number;
  subtotal: number;
};

type FilaPedido = {
  id: string;
  numero_pedido: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  cliente_ciudad: string;
  notas_cliente: string | null;
  subtotal: number | null;
  descuento: number | null;
  porcentaje_descuento: number | null;
  por_mayor: boolean | null;
  total: number;
  estado: EstadoPedido;
  created_at: string;
  order_items: FilaLinea[] | null;
};

const ordenTono = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** `order_items` no guarda el orden de la bolsa: se juntan por producto y los tonos van como en la foto. */
function enOrden(a: LineaPedido, b: LineaPedido): number {
  return ordenTono.compare(a.referencia, b.referencia) || ordenTono.compare(a.tono ?? "", b.tono ?? "");
}

/** Postgres da microsegundos y «+00:00»; Safari viejo no los entiende al leer «Mis pedidos». */
function comoIso(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? fecha : d.toISOString();
}

function mapear(f: FilaPedido): Pedido {
  const descuento = f.descuento ?? 0;
  return {
    id: f.id,
    numeroPedido: f.numero_pedido,
    clienteNombre: f.cliente_nombre,
    clienteWhatsapp: f.cliente_whatsapp,
    clienteCiudad: f.cliente_ciudad,
    notasCliente: f.notas_cliente?.trim() || null,
    // Los pedidos anteriores a la columna guardaron subtotal 0.
    subtotal: f.subtotal || f.total + descuento,
    descuento,
    porcentajeDescuento: f.porcentaje_descuento ?? 0,
    porMayor: f.por_mayor ?? false,
    total: f.total,
    estado: f.estado,
    notasAdmin: null,
    creadoEn: comoIso(f.created_at),
    lineas: (f.order_items ?? [])
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

// El id (UUID) es la llave de la página del pedido: no se adivina y permite volver desde el chat sin cuenta.
// null si no existe; si la base falla lanza, para que la página ofrezca reintentar.
export async function obtenerPedidoPublico(id: string): Promise<Pedido | null> {
  if (!esUuid(id)) return null;

  const { data, error } = await clienteAdmin()
    .from("orders")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<FilaPedido, { merge: false }>();

  if (error) {
    console.error("[pedido] no se pudo cargar el pedido:", error);
    throw new Error("No se pudo cargar el pedido.");
  }
  return data ? mapear(data) : null;
}
