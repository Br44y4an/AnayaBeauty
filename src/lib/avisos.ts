import { create } from "zustand";

export type Aviso = {
  id: number;
  titulo: string;
  detalle?: string;
  imagen?: string | null;
  accion?: { etiqueta: string; href?: string; alHacer?: () => void };
};

export const DURACION_AVISO_MS = 5000;

const useAvisos = create<{ actual: Aviso | null }>(() => ({ actual: null }));
let siguienteId = 1;
let temporizador: ReturnType<typeof setTimeout> | undefined;

function programarCierre(id: number) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (useAvisos.getState().actual?.id === id) useAvisos.setState({ actual: null });
  }, DURACION_AVISO_MS);
}

/** Muestra un aviso en lugar del actual; se cierra solo a los 5 s. */
export function mostrarAviso(aviso: Omit<Aviso, "id">): void {
  const nuevo = { ...aviso, id: siguienteId++ };
  useAvisos.setState({ actual: nuevo });
  programarCierre(nuevo.id);
}

export function cerrarAviso(): void {
  clearTimeout(temporizador);
  useAvisos.setState({ actual: null });
}

/** Detiene el cierre mientras la clienta lo toca o lo enfoca (WCAG 2.2.1). */
export function pausarAviso(): void {
  clearTimeout(temporizador);
}

export function reanudarAviso(): void {
  const actual = useAvisos.getState().actual;
  if (actual) programarCierre(actual.id);
}

export function avisoActual(): Aviso | null {
  return useAvisos.getState().actual;
}

export function useAvisoActual(): Aviso | null {
  return useAvisos((estado) => estado.actual);
}
