/**
 * Motor de precios por escalones de cantidad.
 *
 * Regla del negocio: se toma el escalón más alto cuyo mínimo no supere la
 * cantidad pedida, y su precio unitario se multiplica por la cantidad.
 * Ejemplo con escalones 1→$10.000, 3→$9.000, 6→$8.000:
 * 4 unidades se cobran a $9.000 cada una, es decir $36.000.
 *
 * Este módulo no importa nada a propósito: es la pieza más probada del
 * sistema y debe poder ejecutarse en cualquier contexto.
 */

export type Escalon = {
  minCantidad: number;
  precioUnitario: number;
};

export type Upsell = {
  unidadesFaltantes: number;
  nuevaCantidad: number;
  nuevoPrecioUnitario: number;
  ahorro: number;
};

function ordenarAscendente(escalones: Escalon[]): Escalon[] {
  return [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);
}

function validar(escalones: Escalon[], cantidad: number): void {
  if (escalones.length === 0) {
    throw new Error("Producto sin escalones de precio configurados");
  }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error(`cantidad inválida: ${cantidad}`);
  }
}

export function precioUnitarioPara(escalones: Escalon[], cantidad: number): number {
  validar(escalones, cantidad);
  const ordenados = ordenarAscendente(escalones);

  let aplicable = ordenados[0];
  for (const escalon of ordenados) {
    if (escalon.minCantidad <= cantidad) {
      aplicable = escalon;
    }
  }
  return aplicable.precioUnitario;
}

export function subtotalPara(escalones: Escalon[], cantidad: number): number {
  return precioUnitarioPara(escalones, cantidad) * cantidad;
}

export function precioDesde(escalones: Escalon[]): number {
  if (escalones.length === 0) {
    throw new Error("Producto sin escalones de precio configurados");
  }
  return Math.min(...escalones.map((e) => e.precioUnitario));
}

export function sugerenciaUpsell(escalones: Escalon[], cantidad: number): Upsell | null {
  validar(escalones, cantidad);
  const ordenados = ordenarAscendente(escalones);

  const siguiente = ordenados.find((e) => e.minCantidad > cantidad);
  if (!siguiente) return null;

  const precioActual = precioUnitarioPara(escalones, cantidad);
  const nuevaCantidad = siguiente.minCantidad;
  const nuevoPrecioUnitario = siguiente.precioUnitario;

  // Cuánto se ahorra por comprar esa cantidad con el escalón nuevo
  // en vez de comprarla al precio que está pagando ahora.
  const ahorro = nuevaCantidad * precioActual - nuevaCantidad * nuevoPrecioUnitario;

  return {
    unidadesFaltantes: nuevaCantidad - cantidad,
    nuevaCantidad,
    nuevoPrecioUnitario,
    ahorro,
  };
}
