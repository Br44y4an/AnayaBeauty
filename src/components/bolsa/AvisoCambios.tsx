import { IconoAlerta } from "@/components/ui/Iconos";
import type { LineaReconciliada } from "@/lib/carrito/reconciliar";
import { nombreVariante, unaVariante } from "@/lib/variantes";
import type { EtiquetaVariante, ProductoBolsa } from "@/lib/types";

/** «Este tono», «Esta paleta». */
function esteDe(etiqueta: EtiquetaVariante): string {
  return `${unaVariante(etiqueta).startsWith("una ") ? "Esta" : "Este"} ${nombreVariante(etiqueta)}`;
}

/** Qué le pasó a una línea al contrastarla con la tienda de hoy; null si nada. */
export function textoDeCambio(l: LineaReconciliada, producto: ProductoBolsa | null): string | null {
  if (l.estado === "ok") return null;
  if (l.estado === "ajustada") {
    return l.cantidad === 1 ? "Solo queda 1: ajustamos la cantidad" : `Solo quedan ${l.cantidad}: ajustamos la cantidad`;
  }

  const vigente = producto !== null && producto.activo && producto.escalones.length > 0;
  if (!vigente) return l.estado === "agotada" ? "Este producto se agotó" : "Este producto ya no está disponible";

  const etiqueta = producto.etiquetaVariante;
  if (l.estado === "no-disponible") {
    return l.linea.tonoNombre ? `${esteDe(etiqueta)} ya no está disponible` : `Elige ${unaVariante(etiqueta)} en la ficha`;
  }
  if (producto.variantes.find((v) => v.id === l.linea.tonoId)?.agotado) return `${esteDe(etiqueta)} se agotó`;
  if (producto.stock <= 0) return "Este producto se agotó";
  // Hay existencia, pero otras variantes del mismo producto (que comparten stock) ya la ocupan.
  return producto.stock === 1
    ? "La única unidad que queda ya está en tu bolsa"
    : `Las ${producto.stock} unidades que quedan ya están en tu bolsa`;
}

/** Aviso de alerta dentro de la línea: el cambio se explica donde ocurrió. */
export function AvisoCambios({ texto }: { texto: string }) {
  return (
    <p className="mt-1 flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2 text-sm leading-5 text-alerta">
      <IconoAlerta tamano={18} className="mt-px shrink-0" />
      {texto}
    </p>
  );
}
