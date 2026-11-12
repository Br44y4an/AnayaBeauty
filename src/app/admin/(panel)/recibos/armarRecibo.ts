import { calcularTotales, unitarioDeLinea, type ReglaDescuento } from "@/lib/discounts";
import {
  destinatarioDePedido,
  fechaDeRecibo,
  queFalta,
  totalesDeRecibo,
  type DatosRecibo,
  type Destinatario,
  type LineaRecibo,
} from "@/lib/admin/recibo";
import type { ConfiguracionPublica, Pedido, Producto } from "@/lib/types";
import { claveCatalogo, type EstadoRecibo } from "./estadoRecibo";

export type ContextoRecibo = {
  pedidos: Pedido[];
  productos: Producto[];
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
  pago: ConfiguracionPublica["pago"];
};

/** Una línea del catálogo o del pedido como se edita en pantalla; `productoId` solo en el recibo manual. */
export type LineaEditable = LineaRecibo & {
  clave: string;
  referencia: string;
  productoId?: string;
  tonoId?: string | null;
};

export type Recibo = {
  pedido: Pedido | null;
  /** Los datos del pedido, para «Volver a los datos del pedido». */
  destinatarioBase: Destinatario;
  destinatarioEditado: boolean;
  lineasCatalogo: LineaEditable[];
  descuentoCalculado: number;
  descuentoAplicado: number;
  mostrarDescuento: boolean;
  ahorroPorMayor: number;
  datos: DatosRecibo;
  falta: string | null;
};

function delCatalogo(e: EstadoRecibo, c: ContextoRecibo) {
  const detalles = e.manual.lineas.flatMap((linea) => {
    const producto = c.productos.find((p) => p.id === linea.productoId);
    return producto ? [{ linea, producto }] : [];
  });
  // Como en la bolsa: los tonos de un producto suman para elegir el escalón.
  const calculo = detalles.map((d) => ({ productoId: d.producto.id, escalones: d.producto.escalones, cantidad: d.linea.cantidad }));
  const totales = calcularTotales(calculo, c.reglas, c.umbralPorMayor);
  const lineas: LineaEditable[] = detalles.map((d, i) => {
    const clave = claveCatalogo(d.producto.id, d.linea.tonoId);
    const unitario = e.manual.precios[clave] ?? unitarioDeLinea(calculo[i], calculo, totales.porMayor);
    return {
      clave,
      productoId: d.producto.id,
      tonoId: d.linea.tonoId,
      referencia: d.producto.referencia,
      nombre: d.producto.nombre,
      tono: d.linea.tonoNombre,
      cantidad: d.linea.cantidad,
      precioUnitario: unitario,
      subtotal: unitario * d.linea.cantidad,
    };
  });
  return {
    lineas,
    descuento: totales.descuento,
    porcentaje: totales.porcentaje,
    porMayor: totales.porMayor,
    ahorroPorMayor: totales.subtotalNormal - totales.subtotalBase,
  };
}

function delPedido(e: EstadoRecibo, pedido: Pedido | null) {
  const lineas: LineaEditable[] = (pedido?.lineas ?? []).map((l) => {
    const unitario = e.pedido.precios[l.id] ?? l.precioUnitarioAplicado;
    return {
      clave: l.id,
      referencia: l.referencia,
      nombre: l.nombre,
      tono: l.tono,
      cantidad: l.cantidad,
      precioUnitario: unitario,
      subtotal: unitario * l.cantidad,
    };
  });
  return {
    lineas,
    descuento: pedido?.descuento ?? 0,
    porcentaje: pedido?.porcentajeDescuento ?? 0,
    porMayor: pedido?.porMayor ?? false,
    ahorroPorMayor: 0,
  };
}

/** Todo lo que se ve y se imprime sale de aquí: la vista previa y el PDF reciben el mismo `datos`. */
export function armarRecibo(e: EstadoRecibo, c: ContextoRecibo): Recibo {
  const enPedido = e.modo === "pedido";
  const modo = enPedido ? e.pedido : e.manual;
  const pedido = enPedido ? (c.pedidos.find((p) => p.id === e.pedido.id) ?? null) : null;
  const catalogo = enPedido ? delPedido(e, pedido) : delCatalogo(e, c);

  const destinatarioBase = pedido ? destinatarioDePedido(pedido) : e.manual.destinatario;
  const destinatario = enPedido ? (e.pedido.destinatario ?? destinatarioBase) : e.manual.destinatario;
  const subtotalCatalogo = catalogo.lineas.reduce((suma, l) => suma + l.subtotal, 0);
  const totales = totalesDeRecibo({
    subtotalCatalogo,
    descuentoCatalogo: modo.descuento ?? catalogo.descuento,
    lineasTexto: modo.lineasTexto,
  });
  const calculado = Math.min(catalogo.descuento, subtotalCatalogo);
  const lineasTexto: LineaRecibo[] = modo.lineasTexto.map((l) => ({
    referencia: null,
    nombre: l.descripcion.trim(),
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    subtotal: l.cantidad * l.precioUnitario,
  }));
  const lineas = [...catalogo.lineas, ...lineasTexto];

  return {
    pedido,
    destinatarioBase,
    destinatarioEditado: enPedido && e.pedido.destinatario !== null,
    lineasCatalogo: catalogo.lineas,
    descuentoCalculado: calculado,
    descuentoAplicado: totales.descuento,
    mostrarDescuento: modo.mostrarDescuento,
    ahorroPorMayor: catalogo.ahorroPorMayor,
    datos: {
      titulo: e.preferencias.titulo,
      numero: (enPedido ? (e.pedido.numero ?? pedido?.numeroPedido) : e.manual.numero) ?? "",
      fecha: fechaDeRecibo(e.fecha),
      destinatario,
      lineas: lineas.map(({ referencia, nombre, tono, cantidad, precioUnitario, subtotal }) => ({
        referencia,
        nombre,
        tono,
        cantidad,
        precioUnitario,
        subtotal,
      })),
      subtotal: totales.subtotal,
      // Ocultar el descuento solo lo saca del desglose: el total sigue siendo el que se cobra.
      descuento: modo.mostrarDescuento ? totales.descuento : 0,
      porcentaje: modo.mostrarDescuento && totales.descuento === catalogo.descuento ? catalogo.porcentaje : 0,
      porMayor: catalogo.porMayor,
      total: totales.total,
      nota: e.preferencias.nota,
      mostrarPago: e.preferencias.mostrarPago,
      pagoMetodo: c.pago.metodo,
      pagoNumero: c.pago.numero,
      pagoTitular: c.pago.titular,
    },
    falta: enPedido && !pedido ? "Elige un pedido." : queFalta({ destinatario, lineas: lineas.length }),
  };
}
