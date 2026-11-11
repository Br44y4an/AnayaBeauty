import type { Escalon } from "@/lib/pricing";

export type BloqueoCompra = "sin-precio" | "agotado" | "sin-seleccion" | "supera-stock";

export type ResumenCompra = {
  unidadesEnBolsa: number;
  unidadesNuevas: number;
  unidadesTotales: number;
  precioUnitario: number;
  subtotalNuevas: number;
  escalonActivo: Escalon | null;
  siguiente: { faltan: number; precioUnitario: number } | null;
  maxNuevas: number;
  bloqueo: BloqueoCompra | null;
};

const unidades = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

function bloqueoDe(stock: number, hayPrecio: boolean, nuevas: number, maxNuevas: number) {
  if (stock === 0) return "agotado";
  if (!hayPrecio) return "sin-precio";
  if (nuevas === 0) return "sin-seleccion";
  if (nuevas > maxNuevas) return "supera-stock";
  return null;
}

/**
 * La única cuenta de compra de la tienda. Las variantes de un producto
 * comparten escalón: lo nuevo se cobra al precio que alcanza junto con lo
 * que ya está en la bolsa.
 */
export function resumenDeCompra(e: {
  escalones: Escalon[];
  stock: number;
  unidadesEnBolsa: number;
  unidadesNuevas: number;
}): ResumenCompra {
  const enBolsa = unidades(e.unidadesEnBolsa);
  const nuevas = unidades(e.unidadesNuevas);
  const stock = unidades(e.stock);
  const totales = enBolsa + nuevas;
  const ordenados = [...e.escalones].sort((a, b) => a.minCantidad - b.minCantidad);

  // Sin nada elegido se muestra el precio de una unidad, no $0.
  const referencia = Math.max(1, totales);
  let escalonActivo: Escalon | null = ordenados[0] ?? null;
  for (const escalon of ordenados) {
    if (escalon.minCantidad <= referencia) escalonActivo = escalon;
  }

  const proximo = ordenados.find((x) => x.minCantidad > referencia);
  const precioUnitario = escalonActivo?.precioUnitario ?? 0;
  const maxNuevas = Math.max(0, stock - enBolsa);

  return {
    unidadesEnBolsa: enBolsa,
    unidadesNuevas: nuevas,
    unidadesTotales: totales,
    precioUnitario,
    subtotalNuevas: precioUnitario * nuevas,
    escalonActivo,
    siguiente:
      proximo && proximo.minCantidad <= stock
        ? { faltan: proximo.minCantidad - totales, precioUnitario: proximo.precioUnitario }
        : null,
    maxNuevas,
    bloqueo: bloqueoDe(stock, ordenados.length > 0, nuevas, maxNuevas),
  };
}
