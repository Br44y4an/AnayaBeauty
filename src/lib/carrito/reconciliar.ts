import type { LineaCarrito } from "@/lib/types";

/**
 * Reconcilia el carrito guardado en el navegador contra lo que de verdad
 * hay en la tienda ahora mismo.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * El carrito vive en `localStorage` y puede tener días. Mientras tanto un
 * producto se agota, se oculta o le queda menos stock del que la clienta
 * apartó. Antes cada pantalla resolvía eso por su cuenta:
 *
 *   · `VistaCarrito` descartaba en silencio las líneas sin stock y pintaba
 *     un total que solo contaba las que sobrevivían;
 *   · `FormularioConfirmar` serializaba las líneas CRUDAS del store, con
 *     las descartadas incluidas.
 *
 * Resultado: el carrito mostraba $80.000, la clienta pulsaba "Confirmar" y
 * el servidor respondía SIN_STOCK por un producto que ella ya no veía en
 * pantalla. La venta se caía en el último paso, que es el peor sitio.
 *
 * Ahora hay una sola respuesta a "¿qué se puede pedir?", y las dos
 * pantallas la usan: lo que se ve es exactamente lo que se envía.
 */

export type Disponibilidad = {
  id: string;
  stock: number;
  activo: boolean;
};

/** Qué le pasó a una línea al contrastarla con la tienda. */
export type EstadoLinea =
  /** Se puede pedir tal cual. */
  | "ok"
  /** Se puede pedir, pero menos unidades de las que pidió. */
  | "ajustada"
  /** No queda ni una unidad. */
  | "agotada"
  /** El producto ya no está en el catálogo. */
  | "no-disponible";

export type LineaReconciliada = {
  linea: LineaCarrito;
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

/**
 * @param lineas        lo que la clienta tiene guardado
 * @param disponibilidad stock y visibilidad actuales, por producto
 *
 * Los tonos de un producto comparten inventario, así que el stock se
 * reparte entre sus líneas en el orden en que fueron agregadas: la
 * primera se sirve completa, la siguiente con lo que quede. Es el mismo
 * criterio que usa `crear_pedido` al validar contra la suma del producto,
 * de modo que un carrito que aquí sale entero no puede fallar allá.
 */
export function reconciliarCarrito(
  lineas: LineaCarrito[],
  disponibilidad: Disponibilidad[]
): CarritoReconciliado {
  const porId = new Map(disponibilidad.map((d) => [d.id, d]));
  const yaRepartido = new Map<string, number>();

  const reconciliadas: LineaReconciliada[] = lineas.map((linea) => {
    const cantidadPedida = Math.max(0, Math.floor(linea.cantidad));
    const producto = porId.get(linea.productoId);

    // Sin fila, o con el producto oculto: ya no existe para la tienda.
    if (!producto || !producto.activo) {
      return { linea, cantidad: 0, cantidadPedida, estado: "no-disponible" };
    }

    const usado = yaRepartido.get(linea.productoId) ?? 0;
    const libre = Math.max(0, producto.stock - usado);
    const cantidad = Math.min(cantidadPedida, libre);

    yaRepartido.set(linea.productoId, usado + cantidad);

    if (cantidad < 1) {
      return { linea, cantidad: 0, cantidadPedida, estado: "agotada" };
    }

    return {
      linea,
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

/**
 * Mensaje corto y sin jerga para explicar una línea que cambió.
 * "Agotado" y "ya no está" son cosas distintas y la clienta merece saber
 * cuál de las dos le pasó.
 */
export function explicarLinea(l: LineaReconciliada, nombre: string): string | null {
  switch (l.estado) {
    case "ok":
      return null;
    case "ajustada":
      return `De ${nombre} quedaban ${l.cantidad}, no ${l.cantidadPedida}. Te dejamos ${l.cantidad}.`;
    case "agotada":
      return `${nombre} se agotó mientras armabas tu pedido.`;
    case "no-disponible":
      return `${nombre} ya no está en el catálogo.`;
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
