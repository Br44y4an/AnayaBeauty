import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineaCarrito } from "@/lib/types";

/**
 * Carrito guardado en el navegador.
 *
 * La identidad de una línea es producto + tono. Dos tonos del mismo labial
 * son dos líneas independientes; el mismo tono suma cantidades.
 *
 * Nunca guarda precios: solo producto + tono + cantidad. El total real lo
 * recalcula PostgreSQL al confirmar, así que un carrito manipulado no
 * puede cambiar lo que se cobra.
 */

type EstadoCarrito = {
  lineas: LineaCarrito[];
  /**
   * Identificador del intento de compra en curso.
   *
   * Viaja hasta `crear_pedido`, que lo guarda en `orders`. Si el mismo
   * envío llega dos veces —doble toque en el botón, o el navegador
   * reintentando tras una señal mala— el servidor reconoce la clave y
   * devuelve el pedido que ya creó, en vez de duplicarlo y descontar el
   * stock otra vez. Se renueva cuando la bolsa vuelve a cambiar.
   */
  claveEnvio: string | null;
  agregar: (
    productoId: string,
    cantidad: number,
    tono?: { id: string; nombre: string } | null
  ) => void;
  establecer: (productoId: string, tonoId: string | null, cantidad: number) => void;
  quitar: (productoId: string, tonoId: string | null) => void;
  vaciar: () => void;
  /** Prepara (o reutiliza) la clave del envío que está por hacerse. */
  prepararEnvio: () => string;
};

/** Identidad de una línea: mismo producto y mismo tono. */
function esLaMisma(l: LineaCarrito, productoId: string, tonoId: string | null): boolean {
  return l.productoId === productoId && l.tonoId === tonoId;
}

/** UUID v4. `crypto.randomUUID` no existe en navegadores viejos ni en SSR. */
function nuevaClave(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const usarCarrito = create<EstadoCarrito>()(
  persist(
    (set, get) => ({
      lineas: [],
      claveEnvio: null,

      agregar: (productoId, cantidad, tono) =>
        set((estado) => {
          if (!Number.isInteger(cantidad) || cantidad < 1) return estado;

          const tonoId = tono?.id ?? null;
          const existente = estado.lineas.find((l) => esLaMisma(l, productoId, tonoId));

          if (existente) {
            return {
              // Cambiar la bolsa invalida el envío preparado: lo que se
              // confirme tiene que ser lo que hay ahora, no lo de antes.
              claveEnvio: null,
              lineas: estado.lineas.map((l) =>
                esLaMisma(l, productoId, tonoId)
                  ? { ...l, cantidad: l.cantidad + cantidad }
                  : l
              ),
            };
          }

          return {
            claveEnvio: null,
            lineas: [
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
      name: "anaya-carrito",
      // v3: desapareció el código de 4 dígitos y apareció la clave de
      // envío. A diferencia de la v2, esta migración CONSERVA las líneas:
      // el formato no cambió y tirar la bolsa de alguien que llevaba
      // media hora armándola sería peor que cualquier incompatibilidad.
      version: 3,
      migrate: (guardado, version) => {
        const previo = (guardado ?? {}) as { lineas?: LineaCarrito[] };
        const lineas = version >= 2 && Array.isArray(previo.lineas) ? previo.lineas : [];
        return { lineas, claveEnvio: null } as unknown as EstadoCarrito;
      },
      partialize: (estado) =>
        ({ lineas: estado.lineas, claveEnvio: estado.claveEnvio }) as unknown as EstadoCarrito,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function totalUnidades(estado: { lineas: LineaCarrito[] }): number {
  return estado.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

/** Cuántas unidades de un producto hay en el carrito, sumando todos sus tonos. */
export function unidadesDeProducto(
  lineas: LineaCarrito[],
  productoId: string
): number {
  return lineas
    .filter((l) => l.productoId === productoId)
    .reduce((suma, l) => suma + l.cantidad, 0);
}

/**
 * Las líneas de un solo producto.
 *
 * Existe para que las tarjetas del catálogo no tengan que suscribirse al
 * carrito entero: con 591 tarjetas en pantalla, cada toque en un "+"
 * volvía a renderizar las 591. Ver `usarLineasDeProducto`.
 */
export function lineasDeProducto(
  lineas: LineaCarrito[],
  productoId: string
): LineaCarrito[] {
  return lineas.filter((l) => l.productoId === productoId);
}

/* =====================================================================
   Suscripciones finas
   =====================================================================

   El catálogo llegó a pintar 591 tarjetas a la vez, y cada una hacía
   `usarCarrito((e) => e.lineas)`: cualquier toque en un "+" cambiaba la
   lista y React volvía a renderizar LAS 591. Ése era el origen de "se
   traba" — no la red, ni la base: el propio navegador.

   Estos dos ayudantes hacen que cada tarjeta se entere solo de lo suyo.
   `useShallow` compara elemento por elemento, y como `agregar` y
   `establecer` conservan la identidad de las líneas que no tocan, la
   tarjeta de un producto ni se despeina cuando cambia otro.
   ===================================================================== */

/** Las líneas de UN producto. Estable mientras ese producto no cambie. */
export function usarLineasDeProducto(productoId: string): LineaCarrito[] {
  return usarCarrito(
    useShallow((estado) => estado.lineas.filter((l) => l.productoId === productoId))
  );
}

/** Unidades de UN producto, sumando sus tonos. Devuelve un número: la
 *  comparación por identidad de React ya basta para no re-renderizar. */
export function usarUnidadesDeProducto(productoId: string): number {
  return usarCarrito((estado) => unidadesDeProducto(estado.lineas, productoId));
}

/** Total de unidades en la bolsa. */
export function usarTotalUnidades(): number {
  return usarCarrito((estado) => totalUnidades(estado));
}
