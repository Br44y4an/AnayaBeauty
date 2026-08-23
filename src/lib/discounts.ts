import { precioUnitarioPara, precioDesde, type Escalon } from "@/lib/pricing";

/**
 * Motor de descuentos por monto.
 *
 * Dos beneficios encadenados:
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

export function calcularTotales(
  lineas: LineaCalculo[],
  reglas: ReglaDescuento[],
  umbralPorMayor: number
): Totales {
  const validas = lineas.filter(esLineaValida);

  const subtotalNormal = validas.reduce(
    (suma, l) => suma + precioUnitarioPara(l.escalones, l.cantidad) * l.cantidad,
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
