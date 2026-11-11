"use client";

import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { Campo } from "@/components/ui/Campo";
import { IconoAlerta, IconoChevron, IconoWhatsApp } from "@/components/ui/Iconos";
import type { FalloConfirmacion } from "@/hooks/useConfirmarPedido";
import { leerDatosCliente } from "@/lib/celular";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export type DatosFormulario = { nombre: string; whatsapp: string; ciudad: string; notas: string; recordar: boolean };
type Obligatorio = "nombre" | "whatsapp" | "ciudad";

const OBLIGATORIOS: readonly Obligatorio[] = ["nombre", "whatsapp", "ciudad"];
const idDe = (campo: string) => `datos-${campo}`;
const SIGUIENTE: Record<string, string> = { [idDe("nombre")]: idDe("whatsapp"), [idDe("whatsapp")]: idDe("ciudad") };

/** Lo que la clienta escribe; si guardó sus datos en este celular, empieza con ellos y con «Recordar» marcado. */
export function useDatosFormulario() {
  const [valores, setValores] = useState<DatosFormulario>(() => {
    const guardados = leerDatosCliente();
    return { nombre: "", whatsapp: "", ciudad: "", notas: "", ...guardados, recordar: guardados !== null };
  });
  const cambiar = useCallback((cambio: Partial<DatosFormulario>) => setValores((v) => ({ ...v, ...cambio })), []);
  return [valores, cambiar] as const;
}

export const primerCampoVacio = (v: DatosFormulario) => OBLIGATORIOS.find((c) => !v[c].trim()) ?? null;

function llevarA(elemento: HTMLElement | null, enfocar: boolean) {
  elemento?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  if (enfocar) elemento?.focus({ preventScroll: true });
}

export function enfocarPrimerVacio(v: DatosFormulario) {
  const campo = primerCampoVacio(v);
  if (campo) llevarA(document.getElementById(idDe(campo)), true);
}

/** Lleva la vista al campo con el error o, si es de la bolsa o del servidor, al aviso arriba del botón. */
export function enfocarError(fallo: FalloConfirmacion) {
  const campo = fallo.campo && fallo.campo !== "bolsa" ? document.getElementById(idDe(fallo.campo)) : null;
  llevarA(campo ?? document.getElementById("error-pedido"), campo !== null);
}

type Props = {
  valores: DatosFormulario;
  onCambiar: (cambio: Partial<DatosFormulario>) => void;
  accion: (datos: FormData) => void;
  /** JSON de `itemsParaPedido`: lo que se envía sale de la misma reconciliación que se ve. */
  items: string;
  adicional: string | null;
  error: FalloConfirmacion | null;
  whatsappNegocio: string;
};

export function FormularioDatos({ valores, onCambiar, accion, items, adicional, error, whatsappNegocio }: Props) {
  const [notaAbierta, setNotaAbierta] = useState(valores.notas !== "");
  const nota = useRef<HTMLTextAreaElement>(null);
  // El error de un campo se retira en cuanto la clienta lo corrige; un envío nuevo trae otro objeto.
  const [corregido, setCorregido] = useState<FalloConfirmacion | null>(null);
  const vigente = error !== corregido ? error : null;
  const errorDe = (campo: Obligatorio) => (vigente?.campo === campo ? vigente.mensaje : null);
  const errorGeneral = error && (!error.campo || error.campo === "bolsa") ? error : null;

  // «Siguiente» en el teclado del celular pasa de campo; nunca confirma el pedido por accidente.
  function alTeclear(e: KeyboardEvent<HTMLFormElement>) {
    const campo = e.target;
    if (e.key !== "Enter" || !(campo instanceof HTMLInputElement) || campo.type === "checkbox") return;
    e.preventDefault();
    const siguiente = document.getElementById(SIGUIENTE[campo.id] ?? "");
    if (siguiente) siguiente.focus();
    else campo.blur();
  }

  function alternarNota() {
    flushSync(() => setNotaAbierta(!notaAbierta));
    if (!notaAbierta) nota.current?.focus();
  }

  const campo = (c: Obligatorio) => ({
    id: idDe(c),
    name: c,
    value: valores[c],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (error?.campo === c) setCorregido(error);
      onCambiar({ [c]: e.target.value });
    },
    error: errorDe(c),
    required: true,
  });

  return (
    <form id="form-pedido" action={accion} onKeyDown={alTeclear} aria-labelledby="titulo-datos" noValidate>
      <h2 id="titulo-datos" className="text-xl font-semibold leading-[26px] text-tinta">
        Tus datos
      </h2>
      <input type="hidden" name="items" value={items} />
      {adicional && <input type="hidden" name="adicional" value={adicional} />}

      <div className="mt-4 space-y-5">
        <Campo
          {...campo("nombre")}
          etiqueta="Nombre"
          ayuda="Nombre y apellido"
          autoComplete="name"
          maxLength={80}
          enterKeyHint="next"
        />
        <Campo
          {...campo("whatsapp")}
          etiqueta="WhatsApp"
          ayuda="Te escribimos a este número para el pago y el envío. Ej.: 300 123 4567"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          enterKeyHint="next"
        />
        <Campo
          {...campo("ciudad")}
          etiqueta="Ciudad"
          autoComplete="address-level2"
          maxLength={60}
          enterKeyHint="done"
        />

        <div>
          <button
            type="button"
            aria-expanded={notaAbierta}
            aria-controls="bloque-nota"
            onClick={alternarNota}
            className="-mx-1 flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[15px] font-semibold text-tinta"
          >
            Agregar una nota (opcional)
            <IconoChevron direccion={notaAbierta ? "arriba" : "abajo"} tamano={20} />
          </button>
          <div id="bloque-nota" hidden={!notaAbierta} className="mt-2">
            <label htmlFor={idDe("notas")} className="block text-[15px] font-semibold leading-5 text-tinta">
              Nota (opcional)
            </label>
            <p id="ayuda-nota" className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
              Ej.: es un regalo, llamar antes de llegar
            </p>
            <textarea
              ref={nota}
              id={idDe("notas")}
              name="notas"
              rows={3}
              maxLength={300}
              value={valores.notas}
              onChange={(e) => onCambiar({ notas: e.target.value })}
              aria-describedby="ayuda-nota"
              className="mt-2 block w-full resize-none rounded-md border border-borde bg-fondo px-3.5 py-2.5 text-base text-tinta"
            />
          </div>
        </div>

        <label className="-mx-1 flex min-h-11 cursor-pointer items-center gap-3 px-1 text-[15px] text-tinta">
          <input
            type="checkbox"
            name="recordar"
            value="si"
            checked={valores.recordar}
            onChange={(e) => onCambiar({ recordar: e.target.checked })}
            className="size-5 shrink-0 cursor-pointer accent-acento"
          />
          Recordar mis datos en este celular
        </label>
      </div>

      <div className="mt-5 space-y-2 text-[13px] leading-[18px] text-tinta-suave">
        <p>
          Al confirmar aceptas que usemos tus datos solo para gestionar tu pedido.{" "}
          <a href="/privacidad" target="_blank" rel="noopener" className="font-semibold text-tinta underline underline-offset-2">
            Política de privacidad
          </a>
          .
        </p>
        <p>Aquí no pagas nada todavía: después de confirmar te mostramos cómo pagar.</p>
      </div>

      {/* Siempre presente: así el lector anuncia el error apenas aparece. */}
      <div id="error-pedido" role="alert" className="scroll-mb-28">
        {vigente && !errorGeneral && <p className="sr-only">{vigente.mensaje}</p>}
        {errorGeneral && (
          <div className="mt-5 rounded-md bg-error-fondo p-3 text-sm leading-5 text-error">
            <p className="flex items-start gap-2">
              <IconoAlerta tamano={18} className="mt-px shrink-0" />
              {errorGeneral.mensaje}
            </p>
            <a
              href={enlaceWhatsApp("Hola, tuve un problema al confirmar mi pedido.", whatsappNegocio)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 pl-[26px] font-semibold text-tinta underline underline-offset-2"
            >
              <IconoWhatsApp tamano={18} />
              Escríbenos por WhatsApp
            </a>
          </div>
        )}
      </div>
    </form>
  );
}
