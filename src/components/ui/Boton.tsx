import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma";
  ancho?: boolean;
};

const estilos = {
  primario:
    "bg-fucsia text-petalo shadow-petalo hover:brightness-110 active:scale-[0.98]",
  secundario:
    "bg-petalo text-fucsia border-2 border-fucsia-suave hover:border-fucsia",
  fantasma: "bg-transparent text-carbon-suave hover:text-fucsia",
};

export function Boton({
  variante = "primario",
  ancho,
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2
        rounded-pastilla px-6 py-3 font-semibold transition duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia
        focus-visible:ring-offset-2 focus-visible:ring-offset-rosa-nube
        disabled:pointer-events-none disabled:opacity-40
        ${estilos[variante]} ${ancho ? "w-full" : ""} ${className}`}
    />
  );
}
