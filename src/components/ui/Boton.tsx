import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma" | "peligro";
  tamano?: "normal" | "grande";
  ancho?: boolean;
  /**
   * Muestra el giro y bloquea el botón.
   *
   * Es lo que evita el doble envío y la sensación de "se trabó": un botón
   * que no responde y no dice nada hace que la clienta lo pulse otra vez.
   * `aria-busy` cuenta lo mismo a los lectores de pantalla.
   */
  cargando?: boolean;
};

const estilos = {
  primario:
    "bg-fucsia text-petalo shadow-petalo hover:brightness-110 active:scale-[0.98]",
  secundario:
    "bg-petalo text-fucsia-texto border-2 border-fucsia-suave hover:border-fucsia active:scale-[0.98]",
  fantasma: "bg-transparent text-carbon-suave hover:text-fucsia-texto underline-offset-4",
  peligro: "bg-petalo text-carbon-suave border-2 border-lila-suave hover:border-carbon-suave",
};

const tamanos = {
  // 52px: por encima del mínimo de 44px que exige tocar con el pulgar, y
  // con holgura para quien tiene menos pulso o la pantalla pequeña.
  normal: "min-h-[52px] px-6 py-3 text-base",
  grande: "min-h-[60px] px-8 py-4 text-lg",
};

export function Boton({
  variante = "primario",
  tamano = "normal",
  ancho,
  cargando = false,
  className = "",
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2
        rounded-pastilla font-semibold transition duration-200
        disabled:pointer-events-none disabled:opacity-45
        ${estilos[variante]} ${tamanos[tamano]} ${ancho ? "w-full" : ""} ${className}`}
    >
      {cargando && <Giro />}
      {children}
    </button>
  );
}

function Giro() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
