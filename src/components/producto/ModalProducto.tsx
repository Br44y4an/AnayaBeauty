"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Hoja } from "@/components/ui/Hoja";

/** Lo que dura la salida de la hoja (usePresencia): se espera antes de volver atrás. */
const SALIDA_MS = 160;

type Cierre = { cerrar: () => void; cerrando: boolean };

const CierreDelModal = createContext<Cierre | null>(null);

/** Dentro de la vista rápida: cómo cerrarla y si ya se está cerrando. null en la página completa. */
export function useModalProducto(): Cierre | null {
  return useContext(CierreDelModal);
}

const esFicha = (ruta: string) => ruta.startsWith("/producto/");

// Vista rápida sobre la tienda (slot @modal). Fuera de /producto/* no pinta nada: el slot conserva su último
// contenido al navegar a otra ruta. Cerrar hace un único history.back() aunque lo pidan dos veces (botón,
// fondo, Escape o «Agregar») y nunca si la clienta ya no está en la ficha que pidió cerrar.
export function ModalProducto({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [rutaVista, setRutaVista] = useState(ruta);
  const pendiente = useRef(false);
  const temporizador = useRef<number | undefined>(undefined);
  const contenido = useRef<HTMLDivElement>(null);
  const rutaPrevia = useRef(ruta);

  if (ruta !== rutaVista) {
    setRutaVista(ruta);
    setSaliendo(false);
  }

  useEffect(() => {
    pendiente.current = false;
    if (rutaPrevia.current === ruta) return;
    rutaPrevia.current = ruta;
    // Saltó a otro producto sin cerrar la hoja: el nuevo empieza arriba y el foco no se pierde.
    const nodo = contenido.current;
    if (nodo?.parentElement) nodo.parentElement.scrollTop = 0;
    nodo?.focus({ preventScroll: true });
  }, [ruta]);
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  if (!esFicha(ruta)) return null;

  function cerrar() {
    const actual = window.location.pathname;
    if (pendiente.current || !esFicha(actual)) return;
    pendiente.current = true;
    setSaliendo(true);
    temporizador.current = window.setTimeout(() => {
      if (window.location.pathname === actual) router.back();
    }, SALIDA_MS);
  }

  return (
    <CierreDelModal value={{ cerrar, cerrando: saliendo }}>
      <Hoja
        abierta={!saliendo}
        alCerrar={cerrar}
        titulo="Detalle del producto"
        tituloVisible={false}
        ancho="amplio"
        pantallaCompleta
      >
        <div ref={contenido} tabIndex={-1} className="outline-none">
          {children}
        </div>
      </Hoja>
    </CierreDelModal>
  );
}
