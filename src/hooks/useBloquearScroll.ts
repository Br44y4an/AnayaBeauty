import { useEffect } from "react";

let activos = 0;

/** Bloquea el scroll de la página (html[data-bloqueo-scroll]); con varias capas, se libera al cerrar la última. */
export function useBloquearScroll(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    activos += 1;
    document.documentElement.setAttribute("data-bloqueo-scroll", "");
    return () => {
      activos -= 1;
      if (activos === 0) document.documentElement.removeAttribute("data-bloqueo-scroll");
    };
  }, [activo]);
}
