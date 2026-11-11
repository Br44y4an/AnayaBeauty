import { useEffect, useState } from "react";

/** Mantiene montada una capa mientras dura su animación de salida. */
export function usePresencia(visible: boolean, salidaMs = 160): { montada: boolean; saliendo: boolean } {
  const [montada, setMontada] = useState(visible);
  if (visible && !montada) setMontada(true);
  const saliendo = montada && !visible;

  useEffect(() => {
    if (!saliendo) return;
    const temporizador = window.setTimeout(() => setMontada(false), salidaMs);
    return () => window.clearTimeout(temporizador);
  }, [saliendo, salidaMs]);

  return { montada, saliendo };
}
