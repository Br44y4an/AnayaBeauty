import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineaCarrito } from "@/lib/types";

/**
 * Bolsa guardada en el navegador. Nunca guarda precios: el total real lo
 * recalcula PostgreSQL al confirmar, así que una bolsa manipulada no cambia
 * lo que se cobra.
 */

export const CLAVE_CARRITO = "anaya-carrito";

type Guardado = {
  lineas: LineaCarrito[];
  /** Llave del intento de compra: un envío repetido devuelve el mismo pedido. */
  claveEnvio: string | null;
};

type EstadoCarrito = Guardado & {
  agregar: (
    productoId: string,
    cantidad: number,
    tono?: { id: string; nombre: string } | null
  ) => void;
  establecer: (productoId: string, tonoId: string | null, cantidad: number) => void;
  quitar: (productoId: string, tonoId: string | null) => void;
  /** Deshacer: devuelve una línea quitada a su posición. */
  restaurar: (linea: LineaCarrito, indice: number) => void;
  vaciar: () => void;
  /** Prepara (o reutiliza) la clave del envío que está por hacerse. */
  prepararEnvio: () => string;
};

/** Identidad de una línea: mismo producto y misma variante. */
function esLaMisma(l: LineaCarrito, productoId: string, tonoId: string | null): boolean {
  return l.productoId === productoId && l.tonoId === tonoId;
}

const esCantidadValida = (n: number) => Number.isInteger(n) && n >= 1;

/** UUID v4. `crypto.randomUUID` no existe en navegadores viejos ni sin HTTPS. */
function nuevaClave(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Todo cambio de la bolsa pone `claveEnvio` en null: lo que se confirme
// tiene que ser lo que hay ahora, no un envío preparado antes.
export const useCarrito = create<EstadoCarrito>()(
  persist(
    (set, get) => ({
      lineas: [],
      claveEnvio: null,

      agregar: (productoId, cantidad, tono) =>
        set((estado) => {
          if (!esCantidadValida(cantidad)) return estado;

          const tonoId = tono?.id ?? null;
          const existe = estado.lineas.some((l) => esLaMisma(l, productoId, tonoId));

          return {
            claveEnvio: null,
            lineas: existe
              ? estado.lineas.map((l) =>
                  esLaMisma(l, productoId, tonoId) ? { ...l, cantidad: l.cantidad + cantidad } : l
                )
              : [
                  ...estado.lineas,
                  { productoId, tonoId, tonoNombre: tono?.nombre ?? null, cantidad },
                ],
          };
        }),

      establecer: (productoId, tonoId, cantidad) =>
        set((estado) => ({
          claveEnvio: null,
          lineas:
            cantidad < 1
              ? estado.lineas.filter((l) => !esLaMisma(l, productoId, tonoId))
              : estado.lineas.map((l) =>
                  esLaMisma(l, productoId, tonoId) ? { ...l, cantidad } : l
                ),
        })),

      quitar: (productoId, tonoId) =>
        set((estado) => ({
          claveEnvio: null,
          lineas: estado.lineas.filter((l) => !esLaMisma(l, productoId, tonoId)),
        })),

      restaurar: (linea, indice) =>
        set((estado) => {
          // Si la clienta ya la volvió a agregar, deshacer no la duplica.
          if (!esCantidadValida(linea.cantidad)) return estado;
          if (estado.lineas.some((l) => esLaMisma(l, linea.productoId, linea.tonoId))) return estado;

          const lineas = [...estado.lineas];
          lineas.splice(Math.min(Math.max(0, indice), lineas.length), 0, linea);
          return { lineas, claveEnvio: null };
        }),

      vaciar: () => set({ lineas: [], claveEnvio: null }),

      prepararEnvio: () => {
        const actual = get().claveEnvio;
        if (actual) return actual;

        const clave = nuevaClave();
        set({ claveEnvio: clave });
        return clave;
      },
    }),
    {
      name: CLAVE_CARRITO,
      // v3 conserva las líneas de la v2: el formato no cambió y tirar una
      // bolsa armada durante media hora es peor que cualquier incompatibilidad.
      version: 3,
      migrate: (guardado, version): Guardado => {
        const previo = guardado as Partial<Guardado> | null;
        const lineas = version >= 2 && Array.isArray(previo?.lineas) ? previo.lineas : [];
        return { lineas, claveEnvio: null };
      },
      partialize: (estado): Guardado => ({ lineas: estado.lineas, claveEnvio: estado.claveEnvio }),
      storage: createJSONStorage<Guardado>(() => localStorage),
    }
  )
);

export function totalUnidades(e: { lineas: LineaCarrito[] }): number {
  return e.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

/** Unidades de un producto sumando sus variantes, que comparten inventario. */
export function unidadesDeProducto(e: { lineas: LineaCarrito[] }, productoId: string): number {
  return e.lineas
    .filter((l) => l.productoId === productoId)
    .reduce((suma, l) => suma + l.cantidad, 0);
}

// Suscripciones finas: cada tarjeta se entera solo de lo suyo. `useShallow`
// compara línea por línea y las acciones conservan la identidad de las que
// no tocan, así que cambiar un producto no vuelve a pintar los demás.

export function useLineasDeProducto(productoId: string): LineaCarrito[] {
  return useCarrito(useShallow((e) => e.lineas.filter((l) => l.productoId === productoId)));
}

export function useUnidadesDeProducto(productoId: string): number {
  return useCarrito((e) => unidadesDeProducto(e, productoId));
}

export function useTotalUnidades(): number {
  return useCarrito(totalUnidades);
}

/**
 * El persist de zustand no escucha otras pestañas: sin esto, la pestaña que
 * se abrió desde WhatsApp pisa la bolsa de la otra en su siguiente cambio.
 */
export function escucharOtrasPestanas(): () => void {
  const alCambiar = (e: StorageEvent) => {
    if (e.key === CLAVE_CARRITO) void useCarrito.persist.rehydrate();
  };
  window.addEventListener("storage", alCambiar);
  return () => window.removeEventListener("storage", alCambiar);
}
