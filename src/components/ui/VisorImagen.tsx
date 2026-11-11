"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent, type RefObject } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { atraparTabulador } from "@/components/ui/Hoja";
import { IconoCerrar, IconoMas, IconoMenos } from "@/components/ui/Iconos";
import { useBloquearScroll } from "@/hooks/useBloquearScroll";
import { usePresencia } from "@/hooks/usePresencia";

type Props = { src: string; alt: string; abierto?: boolean; alCerrar: () => void };

/** Foto a pantalla completa: doble toque o pellizco hasta 2×, «Ampliar» para teclado, Escape y foco en Cerrar. */
export function VisorImagen({ src, alt, abierto = true, alCerrar }: Props) {
  const { montada, saliendo } = usePresencia(abierto);
  const capa = useRef<HTMLDivElement>(null);
  const cerrarBoton = useRef<HTMLButtonElement>(null);
  useBloquearScroll(montada);

  // Escucha en captura y corta la propagación: Escape cierra solo el visor, no la hoja o el modal de debajo.
  const alPulsar = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      alCerrar();
    } else if (evento.key === "Tab" && capa.current) {
      evento.stopPropagation();
      atraparTabulador(evento, capa.current);
    }
  });

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cerrarBoton.current?.focus({ preventScroll: true });
    const oyente = (evento: KeyboardEvent) => alPulsar(evento);
    window.addEventListener("keydown", oyente, true);
    return () => {
      window.removeEventListener("keydown", oyente, true);
      if (previo?.isConnected) previo.focus({ preventScroll: true });
    };
  }, [abierto]);

  if (!montada) return null;
  const cerrar = saliendo ? () => {} : alCerrar;

  return (
    <div
      ref={capa}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={`fixed inset-0 z-[60] bg-tinta/95 ${saliendo ? "animate-desaparecer" : "animate-aparecer"}`}
    >
      <Escena key={src} src={src} alt={alt} alTocarFondo={cerrar} />
      <button
        ref={cerrarBoton}
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex size-11 cursor-pointer
                   items-center justify-center rounded-full bg-fondo text-tinta"
      >
        <IconoCerrar tamano={22} />
      </button>
    </div>
  );
}

function Escena({ src, alt, alTocarFondo }: { src: string; alt: string; alTocarFondo: () => void }) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "error">("cargando");
  const escenario = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const zoom = useZoom(escenario, imagen, alTocarFondo);
  const { escala, x, y } = zoom.vista;

  return (
    <>
      <div
        ref={escenario}
        {...zoom.manejadores}
        className="absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden px-4 py-16"
      >
        {estado === "cargando" && <Esqueleto className="absolute aspect-square w-[min(70vw,24rem)]" />}
        {estado === "error" ? (
          <p className="text-base text-fondo">No pudimos cargar la imagen.</p>
        ) : (
          <Image
            ref={imagen}
            src={src}
            alt={alt}
            width={1200}
            height={1200}
            sizes="100vw"
            loading="eager"
            draggable={false}
            onLoad={() => setEstado("lista")}
            onError={() => setEstado("error")}
            style={{ transform: `translate(${x}px, ${y}px) scale(${escala})` }}
            className={`h-auto max-h-full w-auto max-w-full ${zoom.enGesto ? "" : "transition duration-200 ease-entrada"} ${
              estado === "lista" ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>
      {estado === "lista" && (
        <button
          type="button"
          onClick={() => zoom.alternar()}
          className={estilosBoton({
            variante: "secundario",
            tamano: "compacto",
            className: "absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2",
          })}
        >
          {escala > 1 ? <IconoMenos tamano={20} /> : <IconoMas tamano={20} />}
          {escala > 1 ? "Reducir" : "Ampliar"}
        </button>
      )}
    </>
  );
}

type Punto = { x: number; y: number };
type Vista = { escala: number } & Punto;
const SIN_ZOOM: Vista = { escala: 1, x: 0, y: 0 };
const ZOOM_MAX = 2;
const DOBLE_TOQUE_MS = 300;

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
const medio = (a: Punto, b: Punto) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Pellizco, arrastre y doble toque con Pointer Events. Las posiciones van relativas al centro del escenario. */
function useZoom(
  escenario: RefObject<HTMLDivElement | null>,
  imagen: RefObject<HTMLImageElement | null>,
  alTocarFondo: () => void
) {
  const [vista, setVista] = useState(SIN_ZOOM);
  const [enGesto, setEnGesto] = useState(false);
  const actual = useRef(SIN_ZOOM);
  const punteros = useRef(new Map<number, Punto>());
  const inicio = useRef<{ vista: Vista; puntos: Punto[] }>({ vista: SIN_ZOOM, puntos: [] });
  const toque = useRef<{ t: number; punto: Punto; enFondo: boolean; movido: boolean } | null>(null);
  const ultimoToque = useRef<{ t: number; punto: Punto } | null>(null);

  function aplicar(v: Vista) {
    const escala = Math.min(ZOOM_MAX, Math.max(1, v.escala));
    const ancho = imagen.current?.offsetWidth ?? 0;
    const alto = imagen.current?.offsetHeight ?? 0;
    const [mx, my] = [((escala - 1) * ancho) / 2, ((escala - 1) * alto) / 2];
    const limitada = { escala, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
    actual.current = limitada;
    setVista(limitada);
  }

  function relativo(evento: PointerEvent): Punto {
    const caja = escenario.current?.getBoundingClientRect();
    if (!caja) return { x: 0, y: 0 };
    return { x: evento.clientX - caja.left - caja.width / 2, y: evento.clientY - caja.top - caja.height / 2 };
  }

  function alternar(punto: Punto = { x: 0, y: 0 }) {
    if (actual.current.escala > 1) aplicar(SIN_ZOOM);
    else aplicar({ escala: ZOOM_MAX, x: -punto.x * (ZOOM_MAX - 1), y: -punto.y * (ZOOM_MAX - 1) });
  }

  function reiniciarInicio() {
    inicio.current = { vista: actual.current, puntos: [...punteros.current.values()] };
  }

  function alBajar(evento: PointerEvent) {
    punteros.current.set(evento.pointerId, relativo(evento));
    reiniciarInicio();
    toque.current =
      punteros.current.size === 1
        ? { t: evento.timeStamp, punto: relativo(evento), enFondo: evento.target === evento.currentTarget, movido: false }
        : null;
  }

  function alMover(evento: PointerEvent) {
    if (!punteros.current.has(evento.pointerId)) return;
    const punto = relativo(evento);
    punteros.current.set(evento.pointerId, punto);
    if (toque.current && distancia(toque.current.punto, punto) > 10) toque.current.movido = true;

    const { vista: v0, puntos: p0 } = inicio.current;
    const puntos = [...punteros.current.values()];
    if (puntos.length >= 2 && p0.length >= 2) {
      const escala = (v0.escala * distancia(puntos[0], puntos[1])) / Math.max(1, distancia(p0[0], p0[1]));
      const [m0, m] = [medio(p0[0], p0[1]), medio(puntos[0], puntos[1])];
      const ancla = { x: (m0.x - v0.x) / v0.escala, y: (m0.y - v0.y) / v0.escala };
      aplicar({ escala, x: m.x - escala * ancla.x, y: m.y - escala * ancla.y });
      setEnGesto(true);
    } else if (puntos.length === 1 && v0.escala > 1 && toque.current?.movido !== false) {
      aplicar({ ...v0, x: v0.x + puntos[0].x - p0[0].x, y: v0.y + puntos[0].y - p0[0].y });
      setEnGesto(true);
    }
  }

  function alSoltar(evento: PointerEvent) {
    punteros.current.delete(evento.pointerId);
    reiniciarInicio();
    if (punteros.current.size === 0) setEnGesto(false);

    const t = toque.current;
    toque.current = null;
    if (evento.type !== "pointerup" || !t || t.movido || evento.timeStamp - t.t > 350) return;
    if (t.enFondo) return alTocarFondo();

    const previo = ultimoToque.current;
    if (previo && evento.timeStamp - previo.t < DOBLE_TOQUE_MS && distancia(previo.punto, t.punto) < 30) {
      ultimoToque.current = null;
      alternar(t.punto);
    } else {
      ultimoToque.current = { t: evento.timeStamp, punto: t.punto };
    }
  }

  return {
    vista,
    enGesto,
    alternar,
    manejadores: {
      onPointerDown: alBajar,
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alSoltar,
    },
  };
}
