"use client";

import { useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import type { Resultado } from "@/lib/admin/resultado";
import { guardarReglaDescuento } from "./actions";
import { FilaRegla, type Regla } from "./FilaRegla";

const SIN_CONEXION = "No se pudo conectar para guardar. Revisa tu internet e intenta otra vez.";

/** Agregar un «X % desde $Y» y activar, desactivar o eliminar los que hay. */
export function ReglasDescuento({ reglas }: { reglas: Regla[] }) {
  const [pendiente, iniciar] = useTransition();
  const [fallo, setFallo] = useState<Extract<Resultado, { ok: false }> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const errores = fallo?.campos ?? {};

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setAviso(null);
    iniciar(async () => {
      const resultado = await guardarReglaDescuento(datos).catch(() => null);
      if (resultado?.ok) {
        setFallo(null);
        setAviso(resultado.mensaje);
        formulario.reset();
        return;
      }
      flushSync(() => setFallo(resultado ?? { ok: false, error: SIN_CONEXION }));
      formulario.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={enviar} noValidate className="space-y-4 rounded-md border border-linea p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
          <Campo
            id="monto_minimo"
            name="monto_minimo"
            etiqueta="Desde (pesos)"
            ayuda="Por ejemplo 50.000."
            inputMode="numeric"
            autoComplete="off"
            error={errores.monto_minimo}
          />
          <Campo
            id="porcentaje"
            name="porcentaje"
            etiqueta="Descuento (%)"
            ayuda="Por ejemplo 5."
            inputMode="numeric"
            autoComplete="off"
            error={errores.porcentaje}
          />
          <Boton type="submit" cargando={pendiente} className="sm:mb-px">
            {pendiente ? "Agregando…" : "Agregar"}
          </Boton>
        </div>
        {fallo && !fallo.campos && <AvisoPanel tono="error">{fallo.error}</AvisoPanel>}
      </form>

      {aviso && <AvisoPanel tono="exito">{aviso}</AvisoPanel>}

      {reglas.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-tinta-suave">
          Aún no hay descuentos por monto. Agrega el primero arriba.
        </p>
      ) : (
        <ul aria-label="Descuentos por monto" className="divide-y divide-linea border-y border-linea">
          {reglas.map((r) => (
            <li key={r.id}>
              <FilaRegla regla={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
