import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Giro } from "@/components/ui/Giro";

export type VarianteBoton = "primario" | "secundario" | "contorno" | "fantasma" | "peligro";
export type TamanoBoton = "compacto" | "normal" | "grande";

type Apariencia = { variante?: VarianteBoton; tamano?: TamanoBoton; ancho?: boolean };

const VARIANTES: Record<VarianteBoton, string> = {
  primario: "bg-acento text-fondo hover:bg-acento-hondo active:bg-acento-hondo",
  secundario: "border border-tinta bg-fondo text-tinta hover:bg-superficie active:bg-superficie",
  contorno: "border border-borde bg-fondo text-tinta hover:border-tinta active:bg-superficie",
  fantasma: "text-tinta hover:bg-superficie active:bg-superficie",
  peligro: "border border-error bg-fondo text-error hover:bg-error-fondo active:bg-error-fondo",
};

const TAMANOS: Record<TamanoBoton, string> = {
  compacto: "min-h-11 px-4 text-[15px]",
  normal: "min-h-13 px-5 text-base",
  grande: "min-h-14 px-6 text-[17px]",
};

// Inactivo legible (fondo inactivo, texto tinta-suave), salvo mientras carga: ahí conserva su color.
const BASE =
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-md text-center " +
  "font-semibold leading-5 transition-colors duration-150 ease-entrada " +
  "disabled:cursor-not-allowed disabled:not-aria-busy:border-transparent " +
  "disabled:not-aria-busy:bg-inactivo disabled:not-aria-busy:text-tinta-suave aria-busy:cursor-wait";

export function estilosBoton({
  variante = "primario",
  tamano = "normal",
  ancho = false,
  className = "",
}: Apariencia & { className?: string } = {}): string {
  return [BASE, VARIANTES[variante], TAMANOS[tamano], ancho ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Boton({
  variante,
  tamano,
  ancho,
  cargando = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Apariencia & { cargando?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={estilosBoton({ variante, tamano, ancho, className })}
    >
      {cargando && <Giro />}
      {children}
    </button>
  );
}

/** Enlace con aspecto de botón: nunca un <button> dentro de un <a>. */
export function BotonEnlace({
  variante,
  tamano,
  ancho,
  className,
  ...props
}: ComponentProps<typeof Link> & Apariencia) {
  return <Link {...props} className={estilosBoton({ variante, tamano, ancho, className })} />;
}
