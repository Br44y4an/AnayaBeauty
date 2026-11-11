import type { InputHTMLAttributes, Ref } from "react";
import { IconoAlerta } from "@/components/ui/Iconos";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  ref?: Ref<HTMLInputElement>;
};

/** Campo con etiqueta visible; la ayuda y el error se leen con el campo (aria-describedby). `className` va al contenedor. */
export function Campo({ id, etiqueta, ayuda, error, className = "", ref, ...props }: Props) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describe = [props["aria-describedby"], idAyuda, idError].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[15px] font-semibold leading-5 text-tinta">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mt-1.5 flex items-start gap-1.5 text-sm leading-5 text-error">
          <IconoAlerta tamano={18} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      <input
        {...props}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe || undefined}
        className="mt-2 block min-h-12 w-full rounded-md border border-borde bg-fondo px-3.5 py-2.5
                   text-base text-tinta placeholder:text-tinta-suave aria-invalid:border-error
                   disabled:bg-inactivo disabled:text-tinta-suave"
      />
    </div>
  );
}
