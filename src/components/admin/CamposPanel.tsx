import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { IconoAlerta, IconoChevron } from "@/components/ui/Iconos";

// Campos del panel con el mismo patrón que ui/Campo: etiqueta visible, ayuda y error leídos con el
// control (aria-describedby). `className` va al contenedor.

type Rotulado = { id: string; etiqueta: string; ayuda?: ReactNode; error?: string | null; className?: string };

export const CONTROL =
  "mt-2 block min-h-12 w-full rounded-md border border-borde bg-fondo px-3.5 py-2.5 text-base text-tinta " +
  "aria-invalid:border-error disabled:bg-inactivo disabled:text-tinta-suave";

function describir(id: string, ayuda: unknown, error: unknown, propio?: string) {
  return [propio, ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

function Rotulo({ id, etiqueta, ayuda, error }: Omit<Rotulado, "className">) {
  return (
    <>
      <label htmlFor={id} className="block text-[15px] font-semibold leading-5 text-tinta">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
          {ayuda}
        </p>
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </>
  );
}

export function MensajeError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm leading-5 text-error">
      <IconoAlerta tamano={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function CampoArea({
  id,
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: Rotulado & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <Rotulo id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} />
      <textarea
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, ayuda, error, props["aria-describedby"])}
        className={`${CONTROL} min-h-24 resize-y leading-6`}
      />
    </div>
  );
}

export function CampoLista({
  id,
  etiqueta,
  ayuda,
  error,
  className = "",
  children,
  ...props
}: Rotulado & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <Rotulo id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} />
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describir(id, ayuda, error, props["aria-describedby"])}
          className={`${CONTROL} cursor-pointer appearance-none pr-11`}
        >
          {children}
        </select>
        <IconoChevron
          tamano={20}
          className="pointer-events-none absolute right-3.5 top-[calc(50%+4px)] -translate-y-1/2 text-tinta-suave"
        />
      </div>
    </div>
  );
}

/** Casilla con forma de interruptor; toda la fila es el objetivo táctil. */
export function Interruptor({
  id,
  etiqueta,
  ayuda,
  className = "",
  ...props
}: { id: string; etiqueta: string; ayuda?: ReactNode; className?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "role"
>) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0 py-2.5">
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold leading-5 text-tinta">
          {etiqueta}
        </label>
        {ayuda && (
          <p id={`${id}-ayuda`} className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
            {ayuda}
          </p>
        )}
      </div>
      <label htmlFor={id} className="relative flex min-h-11 shrink-0 cursor-pointer items-center">
        <input
          {...props}
          id={id}
          type="checkbox"
          role="switch"
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-11 rounded-full bg-borde transition-colors duration-150 ease-entrada
                     peer-checked:bg-tinta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2
                     peer-focus-visible:outline-acento peer-disabled:bg-inactivo"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 size-5 rounded-full bg-fondo transition-transform duration-150 ease-entrada
                     peer-checked:translate-x-5"
        />
      </label>
    </div>
  );
}
