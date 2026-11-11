"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import type { Resultado } from "@/lib/admin/resultado";
import { pesos } from "@/lib/format";
import { guardarAjustes } from "../configuracion/actions";

const SIN_CONEXION = "No se pudo conectar para guardar. Revisa tu internet e intenta otra vez.";

export function FormularioUmbral({ umbral }: { umbral: number }) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const error = resultado && !resultado.ok ? (resultado.campos?.umbral_por_mayor ?? resultado.error) : null;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setResultado(null);
    iniciar(async () => {
      setResultado((await guardarAjustes(datos).catch(() => null)) ?? { ok: false, error: SIN_CONEXION });
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          id="umbral_por_mayor"
          name="umbral_por_mayor"
          etiqueta="Desde (pesos)"
          defaultValue={pesos(umbral).replace("$", "")}
          inputMode="numeric"
          autoComplete="off"
          error={error}
          className="w-full max-w-60 flex-1"
        />
        <Boton type="submit" variante="secundario" cargando={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
      {resultado?.ok && <AvisoPanel tono="exito">Guardaste el monto del precio por mayor.</AvisoPanel>}
    </form>
  );
}
