import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineaCarrito } from "@/lib/types";

/**
 * Carrito guardado en el navegador.
 *
 * La identidad de una línea es producto + tono. Dos tonos del mismo labial
 * son dos líneas independientes; el mismo tono suma cantidades.
 */

type EstadoCarrito = {
  lineas: LineaCarrito[];
  codigo: string | null;
  agregar: (
    productoId: string,
    cantidad: number,
    tono?: { id: string; nombre: string } | null
  ) => void;
  establecer: (productoId: string, tonoId: string | null, cantidad: number) => void;
  quitar: (productoId: string, tonoId: string | null) => void;
  vaciar: () => void;
  guardarCodigo: (codigo: string) => void;
};

/** Identidad de una línea: mismo producto y mismo tono. */
function esLaMisma(l: LineaCarrito, productoId: string, tonoId: string | null): boolean {
  return l.productoId === productoId && l.tonoId === tonoId;
}

export const usarCarrito = create<EstadoCarrito>()(
  persist(
    (set) => ({
      lineas: [],
      codigo: null,

      agregar: (productoId, cantidad, tono) =>
        set((estado) => {
          if (!Number.isInteger(cantidad) || cantidad < 1) return estado;

          const tonoId = tono?.id ?? null;
          const existente = estado.lineas.find((l) => esLaMisma(l, productoId, tonoId));

          if (existente) {
            return {
              lineas: estado.lineas.map((l) =>
                esLaMisma(l, productoId, tonoId)
                  ? { ...l, cantidad: l.cantidad + cantidad }
                  : l
              ),
            };
          }

          return {
            lineas: [
              ...estado.lineas,
              { productoId, tonoId, tonoNombre: tono?.nombre ?? null, cantidad },
            ],
          };
        }),

      establecer: (productoId, tonoId, cantidad) =>
        set((estado) => ({
          lineas:
            cantidad < 1
              ? estado.lineas.filter((l) => !esLaMisma(l, productoId, tonoId))
              : estado.lineas.map((l) =>
                  esLaMisma(l, productoId, tonoId) ? { ...l, cantidad } : l
                ),
        })),

      quitar: (productoId, tonoId) =>
        set((estado) => ({
          lineas: estado.lineas.filter((l) => !esLaMisma(l, productoId, tonoId)),
        })),

      vaciar: () => set({ lineas: [], codigo: null }),

      guardarCodigo: (codigo) => set({ codigo }),
    }),
    {
      name: "anaya-carrito",
      // Subir la versión descarta carritos del formato anterior, que no
      // tenían tono y romperían el cálculo.
      version: 2,
      migrate: () => ({ lineas: [], codigo: null }),
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
