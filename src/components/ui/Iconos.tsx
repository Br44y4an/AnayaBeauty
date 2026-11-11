import type { ReactNode, SVGProps } from "react";

/** Iconos de línea propios: cuadrícula de 24, trazo 1,75, puntas redondas, `currentColor`. */
export type PropsIcono = SVGProps<SVGSVGElement> & { tamano?: number };

function Icono({ tamano = 24, children, ...props }: PropsIcono & { children: ReactNode }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconoBuscar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </Icono>
  );
}

export function IconoBolsa(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4.75 8.25h14.5l-1.1 11.6a1.25 1.25 0 0 1-1.24 1.15H7.09a1.25 1.25 0 0 1-1.24-1.15L4.75 8.25Z" />
      <path d="M8.75 10.5V7a3.25 3.25 0 0 1 6.5 0v3.5" />
    </Icono>
  );
}

export function IconoCerrar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icono>
  );
}

export function IconoAtras(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Icono>
  );
}

const CHEVRONES = {
  abajo: "m6 9 6 6 6-6",
  arriba: "m6 15 6-6 6 6",
  izquierda: "m15 6-6 6 6 6",
  derecha: "m9 6 6 6-6 6",
} as const;

export function IconoChevron({
  direccion = "abajo",
  ...props
}: PropsIcono & { direccion?: keyof typeof CHEVRONES }) {
  return (
    <Icono {...props}>
      <path d={CHEVRONES[direccion]} />
    </Icono>
  );
}

export function IconoMas(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icono>
  );
}

export function IconoMenos(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M5 12h14" />
    </Icono>
  );
}

export function IconoEliminar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75V7" />
      <path d="m6 7 .9 12.1a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Icono>
  );
}

export function IconoCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icono>
  );
}

export function IconoCopiar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </Icono>
  );
}

export function IconoCompartir(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 3.5v11" />
      <path d="m7.75 7.75 4.25-4.25 4.25 4.25" />
      <path d="M8.5 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-2" />
    </Icono>
  );
}

export function IconoAlerta(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10.27 4.9 3.1 17.4a2 2 0 0 0 1.73 3h14.34a2 2 0 0 0 1.73-3L13.73 4.9a2 2 0 0 0-3.46 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </Icono>
  );
}

export function IconoInfo(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </Icono>
  );
}

/** Glifo de la marca WhatsApp: el único icono relleno del set. */
export function IconoWhatsApp(props: PropsIcono) {
  return (
    <Icono fill="currentColor" stroke="none" {...props}>
      <path
        transform="translate(1.5 1.5) scale(0.875)"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
      />
    </Icono>
  );
}

// Alias temporales de la v4: los usan pantallas que se reescriben en esta versión; la integración los borra.
export const IconoFlechaIzquierda = (props: PropsIcono) => <IconoChevron direccion="izquierda" {...props} />;
export const IconoFlechaAbajo = (props: PropsIcono) => <IconoChevron direccion="abajo" {...props} />;
export const IconoBasura = IconoEliminar;
export const IconoLupa = IconoBuscar;

export function IconoCorazon(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 20s-7-4.4-8.6-8.3A4.8 4.8 0 0 1 12 7.1a4.8 4.8 0 0 1 8.6 4.6C19 15.6 12 20 12 20Z" />
    </Icono>
  );
}

export function IconoPaleta(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.9a4.6 4.6 0 0 0 4.6-4.6c0-3.8-3.8-7-8.8-7Z" />
      <circle cx="7.75" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.75" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.25" cy="8.5" r="1" fill="currentColor" stroke="none" />
    </Icono>
  );
}

export function IconoEtiqueta(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5-8.5-8.5Z" />
      <circle cx="8" cy="8" r="1.25" />
    </Icono>
  );
}

export function IconoLapiz(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    </Icono>
  );
}
