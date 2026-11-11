import type { LineaCarrito, Variante } from "@/lib/types";
import { normalizarTexto } from "@/lib/data/busqueda";

// Contrasta la bolsa guardada en el navegador (puede tener días) con la tienda de ahora. Lo que se
// pinta y lo que se envía salen de aquí: lo que la clienta ve es exactamente lo que se pide.

export type Disponibilidad = {
  id: string;
  stock: number;
  activo: boolean;
  variantes: Variante[];
};

/** Qué le pasó a una línea al contrastarla con la tienda. */
export type EstadoLinea =
  /** Se puede pedir tal cual. */
  | "ok"
  /** Se puede pedir, pero menos unidades de las que pidió. */
  | "ajustada"
  /** No queda ni una unidad, o su variante está agotada. */
  | "agotada"
  /** El producto o su variante ya no están en el catálogo. */
  | "no-disponible";

export type LineaReconciliada = {
  /** La línea con la variante vigente: id y nombre de hoy. */
  linea: LineaCarrito;
  /** La línea tal como está guardada: con ella se cambia o se quita de la bolsa. */
  original: LineaCarrito;
  /** Unidades realmente pedibles. 0 si no se puede pedir nada. */
  cantidad: number;
  /** Lo que la clienta había pedido, para poder explicarle el ajuste. */
  cantidadPedida: number;
  estado: EstadoLinea;
};

export type CarritoReconciliado = {
  /** Todas las líneas, en el orden original, con su estado. */
  lineas: LineaReconciliada[];
  /** Las que sí se pueden pedir (cantidad ≥ 1). */
  pedibles: LineaReconciliada[];
  /** Las que hay que explicar: ajustadas, agotadas o retiradas. */
  conProblema: LineaReconciliada[];
  /** Hay algo que contarle a la clienta antes de que pulse confirmar. */
  hayCambios: boolean;
};

const mismoNombre = (a: string, b: string) =>
  normalizarTexto(a).trim() === normalizarTexto(b).trim();

/** El panel de la v4 regeneraba los id de las variantes al guardar: si el id ya no existe, se busca por nombre. */
function varianteVigente(linea: LineaCarrito, variantes: Variante[]): Variante | null {
  const nombre = linea.tonoNombre;
  return (
    variantes.find((v) => v.id === linea.tonoId) ??
    (nombre === null ? undefined : variantes.find((v) => mismoNombre(v.nombre, nombre))) ??
    null
  );
}

/** Las variantes comparten el stock del producto: se reparte entre sus líneas en el orden en que se agregaron,
 * como hace `crear_pedido`, para que una bolsa que aquí sale entera no falle allá. */
export function reconciliarCarrito(
  lineas: LineaCarrito[],
  disponibilidad: Disponibilidad[]
): CarritoReconciliado {
  const porId = new Map(disponibilidad.map((d) => [d.id, d]));
  const yaRepartido = new Map<string, number>();

  const reconciliadas = lineas.map((original): LineaReconciliada => {
    const cantidadPedida = Math.max(0, Math.floor(original.cantidad));
    const sinNada = (linea: LineaCarrito, estado: EstadoLinea): LineaReconciliada => ({
      linea,
      original,
      cantidad: 0,
      cantidadPedida,
      estado,
    });

    const producto = porId.get(original.productoId);
    if (!producto || !producto.activo) return sinNada(original, "no-disponible");

    let linea = original;
    if (producto.variantes.length > 0) {
      const variante = varianteVigente(original, producto.variantes);
      if (!variante) return sinNada(original, "no-disponible");

      if (variante.id !== original.tonoId || variante.nombre !== original.tonoNombre) {
        linea = { ...original, tonoId: variante.id, tonoNombre: variante.nombre };
      }
      if (variante.agotado) return sinNada(linea, "agotada");
    }

    const usado = yaRepartido.get(original.productoId) ?? 0;
    const cantidad = Math.min(cantidadPedida, Math.max(0, producto.stock - usado));
    yaRepartido.set(original.productoId, usado + cantidad);

    if (cantidad < 1) return sinNada(linea, "agotada");
    return {
      linea,
      original,
      cantidad,
      cantidadPedida,
      estado: cantidad < cantidadPedida ? "ajustada" : "ok",
    };
  });

  const pedibles = reconciliadas.filter((l) => l.cantidad >= 1);
  const conProblema = reconciliadas.filter((l) => l.estado !== "ok");

  return {
    lineas: reconciliadas,
    pedibles,
    conProblema,
    hayCambios: conProblema.length > 0,
  };
}

/** Mensaje corto para una línea que cambió: «se agotó» y «ya no está disponible» son cosas distintas. */
export function explicarLinea(l: LineaReconciliada, nombre: string): string | null {
  const variante = l.linea.tonoNombre;

  switch (l.estado) {
    case "ok":
      return null;
    case "ajustada":
      return `De ${variante ? `${nombre} (${variante})` : nombre} solo quedan ${l.cantidad}: ajustamos la cantidad (pediste ${l.cantidadPedida}).`;
    case "agotada":
      return `${variante ? `${variante} de ${nombre}` : nombre} se agotó.`;
    case "no-disponible":
      return `${variante ? `${variante} de ${nombre}` : nombre} ya no está disponible.`;
  }
}

/** Lo que se manda al servidor: solo lo que de verdad se puede pedir. */
export function itemsParaPedido(
  carrito: CarritoReconciliado
): { producto_id: string; cantidad: number; tono: string | null }[] {
  return carrito.pedibles.map((l) => ({
    producto_id: l.linea.productoId,
    cantidad: l.cantidad,
    tono: l.linea.tonoNombre,
  }));
}
