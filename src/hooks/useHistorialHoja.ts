import { useCallback, useEffect, useEffectEvent, useRef } from "react";

const CLAVE = "hojaAbierta";

function enSuEntrada(id: string | null): boolean {
  return id !== null && (window.history.state as Record<string, unknown> | null)?.[CLAVE] === id;
}

// «Atrás» cierra la hoja en vez de sacar a la clienta de la tienda: al abrir agrega una entrada en la misma
// URL y `cerrar()` hace un único history.back() aunque la toquen dos veces. Los enlaces dentro de la hoja
// deben navegar con `replace` para no dejar esa entrada huérfana.
export function useHistorialHoja(abierta: boolean, alCerrar: () => void): { cerrar: () => void } {
  const entrada = useRef<string | null>(null);
  const volviendo = useRef(false);
  const cerrarDesdeHistorial = useEffectEvent(() => alCerrar());

  useEffect(() => {
    if (!abierta) {
      if (enSuEntrada(entrada.current) && !volviendo.current) {
        volviendo.current = true;
        window.history.back();
      }
      entrada.current = null;
      return;
    }

    if (!enSuEntrada(entrada.current)) {
      entrada.current = `${Date.now()}-${Math.random()}`;
      volviendo.current = false;
      window.history.pushState({ ...window.history.state, [CLAVE]: entrada.current }, "");
    }
    const id = entrada.current;

    const alVolver = (evento: PopStateEvent) => {
      if ((evento.state as Record<string, unknown> | null)?.[CLAVE] === id) return;
      entrada.current = null;
      cerrarDesdeHistorial();
    };
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, [abierta]);

  const cerrar = useCallback(() => {
    if (volviendo.current) return;
    if (enSuEntrada(entrada.current)) {
      volviendo.current = true;
      window.history.back();
    } else {
      alCerrar();
    }
  }, [alCerrar]);

  return { cerrar };
}
