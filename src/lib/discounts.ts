import { precioUnitarioPara, precioDesde, type Escalon } from "@/lib/pricing";

/**
 * Motor de descuentos por monto.
 *
 * El escalón de cada línea NO lo decide su propia cantidad, sino la suma de
 * todas las líneas de ese producto: los tonos de un mismo labial comparten
 * inventario y también comparten escalón. Rojo x2 + Nude x1 = 3 unidades, y
 * las tres se cobran al precio del escalón de 3.
 *
 * Sobre eso van dos beneficios encadenados:
 *
 *   1. PRECIO POR MAYOR — si el carrito alcanza el umbral, cada producto pasa
 *      a su precio unitario más bajo, sin importar cuántas unidades lleve.
 *   2. DESCUENTO PORCENTUAL — sobre el resultado anterior se aplica el
 *      porcentaje de la regla activa de mayor monto que el carrito alcance.
 *
 * Esta implementación debe coincidir al peso con crear_pedido en PostgreSQL.
 */

export type ReglaDescuento = {
  montoMinimo: number;
  porcentaje: number;
};

export type LineaCalculo = {
  /** Agrupa las líneas del mismo producto: sus tonos comparten escalón. */
  productoId: string;
  escalones: Escalon[];
  cantidad: number;
};

export type Totales = {
  /** Suma con los escalones normales, antes de cualquier beneficio. */
  subtotalNormal: number;
  /** Subtotal tras aplicar (o no) el precio por mayor. */
  subtotalBase: number;
  porMayor: boolean;
  porcentaje: number;
  descuento: number;
  total: number;
  /** Cuánto se ahorró frente a subtotalNormal. */
  ahorroTotal: number;
};

function esLineaValida(l: LineaCalculo): boolean {
  return l.escalones.length > 0 && Number.isInteger(l.cantidad) && l.cantidad >= 1;
}

/**
 * Unidades de cada producto en el carrito, sumando todas sus líneas.
 * Es la cantidad que decide el escalón, no la de la línea suelta.
 */
export function cantidadesPorProducto(lineas: LineaCalculo[]): Map<string, number> {
  const cantidades = new Map<string, number>();
  for (const l of lineas.filter(esLineaValida)) {
    cantidades.set(l.productoId, (cantidades.get(l.productoId) ?? 0) + l.cantidad);
  }
  return cantidades;
}

/**
 * Precio unitario final de una línea: el escalón lo decide el total del
 * producto (todos sus tonos) y, si hay precio por mayor, se reemplaza por el
 * más bajo configurado. Es la función que debe usar la interfaz para pintar
 * precios, para no reimplementar la regla en cada pantalla.
 */
export function unitarioDeLinea(
  linea: LineaCalculo,
  lineas: LineaCalculo[],
  porMayor: boolean
): number {
  if (porMayor) return precioDesde(linea.escalones);

  const cantidad = cantidadesPorProducto(lineas).get(linea.productoId) ?? linea.cantidad;
  return precioUnitarioPara(linea.escalones, cantidad);
}

export function calcularTotales(
  lineas: LineaCalculo[],
  reglas: ReglaDescuento[],
  umbralPorMayor: number
): Totales {
  const validas = lineas.filter(esLineaValida);
  const cantidades = cantidadesPorProducto(validas);

  // El escalón sale del total del producto; el aporte de cada línea al
  // subtotal es su propia cantidad a ese precio compartido.
  const subtotalNormal = validas.reduce(
    (suma, l) =>
      suma +
      precioUnitarioPara(l.escalones, cantidades.get(l.productoId) ?? l.cantidad) * l.cantidad,
    0
  );

  // La decisión se toma con los precios normales y NO se revierte después.
  // Si se recalculara sobre el subtotal ya rebajado, aplicar el beneficio lo
  // bajaría del umbral, lo desactivaría, volvería a subir, y así sin fin.
  const porMayor = subtotalNormal > 0 && subtotalNormal >= umbralPorMayor;

  const subtotalBase = porMayor
    ? validas.reduce((suma, l) => suma + precioDesde(l.escalones) * l.cantidad, 0)
    : subtotalNormal;

  const porcentaje = porcentajeAplicable(subtotalBase, reglas);
  const descuento = Math.round((subtotalBase * porcentaje) / 100);
  const total = subtotalBase - descuento;

  return {
    subtotalNormal,
    subtotalBase,
    porMayor,
    porcentaje,
    descuento,
    total,
    ahorroTotal: subtotalNormal - total,
  };
}

/** La regla de mayor monto mínimo que el subtotal alcanza. */
export function porcentajeAplicable(subtotal: number, reglas: ReglaDescuento[]): number {
  const aplicables = reglas
    .filter((r) => r.porcentaje > 0 && r.porcentaje <= 100 && subtotal >= r.montoMinimo)
    .sort((a, b) => b.montoMinimo - a.montoMinimo);

  return aplicables[0]?.porcentaje ?? 0;
}

/**
 * Cuánto le falta al carrito para el siguiente beneficio.
 * Sirve para empujar el ticket: «te faltan $12.000 para el 10%».
 */
export function siguienteBeneficio(
  subtotalNormal: number,
  reglas: ReglaDescuento[],
  umbralPorMayor: number
): { falta: number; descripcion: string } | null {
  const candidatos: { monto: number; descripcion: string }[] = [];

  if (subtotalNormal < umbralPorMayor) {
    candidatos.push({
      monto: umbralPorMayor,
      descripcion: "¡el precio por mayor en todo tu pedido!",
    });
  }

  const porcentajeActual = porcentajeAplicable(subtotalNormal, reglas);
  for (const r of reglas) {
    if (r.porcentaje > porcentajeActual && subtotalNormal < r.montoMinimo) {
      candidatos.push({ monto: r.montoMinimo, descripcion: `${r.porcentaje}% de descuento` });
    }
  }

  if (candidatos.length === 0) return null;

  const masCercano = candidatos.sort((a, b) => a.monto - b.monto)[0];
  return {
    falta: masCercano.monto - subtotalNormal,
    descripcion: masCercano.descripcion,
  };
}
