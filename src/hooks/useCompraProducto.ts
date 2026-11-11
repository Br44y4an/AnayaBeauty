import { useState, useSyncExternalStore } from "react";
import { useCarrito, useLineasDeProducto } from "@/lib/cart";
import { resumenDeCompra, type ResumenCompra } from "@/lib/compra";
import { mostrarAviso } from "@/lib/avisos";
import { vibrar } from "@/lib/dispositivo";
import type { LineaCarrito, Producto } from "@/lib/types";

/** Clave de la selección de un producto sin variantes. */
export const CLAVE_UNICA = "unica";

type Seleccion = Record<string, number>;

const SIN_LINEAS: LineaCarrito[] = [];
const suma = (valores: number[]) => valores.reduce((total, n) => total + n, 0);

// El servidor no ve el localStorage: hasta hidratar se pinta la bolsa vacía, como en el HTML del servidor.
const alHidratar = (avisar: () => void) => useCarrito.persist?.onFinishHydration(avisar) ?? (() => {});
const estaHidratada = () => useCarrito.persist?.hasHydrated() ?? true;
const enServidor = () => false;

/** Líneas de este producto en la bolsa, sin desajustes al hidratar la página. */
export function useLineasEnBolsa(productoId: string): LineaCarrito[] {
  const hidratada = useSyncExternalStore(alHidratar, estaHidratada, enServidor);
  const lineas = useLineasDeProducto(productoId);
  return hidratada ? lineas : SIN_LINEAS;
}

/**
 * Lo que la clienta va eligiendo en la ficha, antes de llevarlo a la bolsa. Las variantes comparten
 * existencias y escalón: el máximo de cada una descuenta la bolsa y lo elegido en las demás.
 */
export function useCompraProducto(producto: Producto): {
  seleccion: Seleccion;
  cambiar: (clave: string, cantidad: number) => void;
  resumen: ResumenCompra;
  agregar: () => boolean;
} {
  const variantes = producto.variantes ?? [];
  const sinVariantes = variantes.length === 0 && producto.numVariantes === 0;
  const inicial = (): Seleccion => (sinVariantes ? { [CLAVE_UNICA]: 1 } : {});

  const [seleccion, setSeleccion] = useState<Seleccion>(inicial);
  const lineas = useLineasEnBolsa(producto.id);
  const resumen = resumenDeCompra({
    escalones: producto.escalones,
    stock: producto.stock,
    unidadesEnBolsa: suma(lineas.map((l) => l.cantidad)),
    unidadesNuevas: suma(Object.values(seleccion)),
  });

  const esElegible = (clave: string) =>
    sinVariantes ? clave === CLAVE_UNICA : variantes.some((v) => v.id === clave && !v.agotado);

  function cambiar(clave: string, cantidad: number) {
    if (!esElegible(clave)) return;
    setSeleccion((actual) => {
      const libres = resumen.maxNuevas - (suma(Object.values(actual)) - (actual[clave] ?? 0));
      const n = Math.min(Number.isFinite(cantidad) ? Math.max(0, Math.floor(cantidad)) : 0, libres);
      const siguiente = { ...actual };
      delete siguiente[clave];
      if (n > 0) siguiente[clave] = n;
      return siguiente;
    });
  }

  function agregar(): boolean {
    if (resumen.bloqueo) return false;

    const { agregar: agregarLinea } = useCarrito.getState();
    if (sinVariantes) agregarLinea(producto.id, seleccion[CLAVE_UNICA]);
    for (const v of variantes) {
      if (seleccion[v.id] > 0) agregarLinea(producto.id, seleccion[v.id], { id: v.id, nombre: v.nombre });
    }

    vibrar(15);
    mostrarAviso({
      titulo: "Agregado a tu bolsa",
      detalle: `${resumen.unidadesNuevas} × ${producto.nombre}`,
      imagen: producto.imagenPrincipal,
      accion: { etiqueta: "Ver bolsa", href: "/carrito" },
    });
    setSeleccion(inicial());
    return true;
  }

  return { seleccion, cambiar, resumen, agregar };
}
