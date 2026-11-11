import { create } from "zustand";

type EstadoBusqueda = { abierta: boolean; textoInicial: string };

const useBusqueda = create<EstadoBusqueda>(() => ({ abierta: false, textoInicial: "" }));

/** Abre la búsqueda rápida (la monta una sola vez el layout de la tienda). */
export function abrirBusqueda(textoInicial = ""): void {
  useBusqueda.setState({ abierta: true, textoInicial });
}

export function cerrarBusqueda(): void {
  useBusqueda.setState({ abierta: false });
}

export function useBusquedaAbierta(): EstadoBusqueda {
  return useBusqueda();
}

/** El estado de este momento, para manejadores que terminan después de un `await`. */
export function busquedaAbierta(): boolean {
  return useBusqueda.getState().abierta;
}
