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
// Pausas activas del aviso en pantalla (puntero y foco pueden coincidir); se reinicia con cada aviso.
let pausas = 0;

function programarCierre(id: number) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (useAvisos.getState().actual?.id === id) useAvisos.setState({ actual: null });
  }, DURACION_AVISO_MS);
}

/** Muestra un aviso en lugar del actual; se cierra solo a los 5 s. */
export function mostrarAviso(aviso: Omit<Aviso, "id">): void {
  const nuevo = { ...aviso, id: siguienteId++ };
  pausas = 0;
  useAvisos.setState({ actual: nuevo });
  programarCierre(nuevo.id);
}

export function cerrarAviso(): void {
  clearTimeout(temporizador);
  pausas = 0;
  useAvisos.setState({ actual: null });
}

/** Detiene el cierre mientras la clienta lo toca o lo enfoca (WCAG 2.2.1). */
export function pausarAviso(): void {
  pausas += 1;
  clearTimeout(temporizador);
}

/** Vuelve a contar los 5 s solo cuando termina la última pausa activa. */
export function reanudarAviso(): void {
  if (pausas === 0) return;
  pausas -= 1;
  const actual = useAvisos.getState().actual;
  if (pausas === 0 && actual) programarCierre(actual.id);
}

export function avisoActual(): Aviso | null {
  return useAvisos.getState().actual;
}

export function useAvisoActual(): Aviso | null {
  return useAvisos((estado) => estado.actual);
}
