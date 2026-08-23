import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineaCarrito } from "@/lib/types";

type EstadoCarrito = {
  lineas: LineaCarrito[];
  codigo: string | null;
  agregar: (productoId: string, cantidad: number) => void;
  establecer: (productoId: string, cantidad: number) => void;
  quitar: (productoId: string) => void;
  vaciar: () => void;
  guardarCodigo: (codigo: string) => void;
};

export const usarCarrito = create<EstadoCarrito>()(
  persist(
    (set) => ({
      lineas: [],
      codigo: null,

      agregar: (productoId, cantidad) =>
        set((estado) => {
          if (!Number.isInteger(cantidad) || cantidad < 1) return estado;

          const existente = estado.lineas.find((l) => l.productoId === productoId);

          return existente
            ? {
                lineas: estado.lineas.map((l) =>
                  l.productoId === productoId
                    ? { ...l, cantidad: l.cantidad + cantidad }
                    : l
                ),
              }
            : { lineas: [...estado.lineas, { productoId, cantidad }] };
        }),

      establecer: (productoId, cantidad) =>
        set((estado) => ({
          lineas:
            cantidad < 1
              ? estado.lineas.filter((l) => l.productoId !== productoId)
              : estado.lineas.map((l) =>
                  l.productoId === productoId ? { ...l, cantidad } : l
                ),
        })),

      quitar: (productoId) =>
        set((estado) => ({
          lineas: estado.lineas.filter((l) => l.productoId !== productoId),
        })),

      vaciar: () => set({ lineas: [], codigo: null }),

      guardarCodigo: (codigo) => set({ codigo }),
    }),
    {
      name: "anaya-carrito",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function totalUnidades(estado: { lineas: LineaCarrito[] }): number {
  return estado.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}
