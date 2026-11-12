"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { LARGO, leerEntero, revisarLineaTexto, type CampoLineaTexto, type LineaTexto } from "@/lib/admin/recibo";

/** Producto escrito a mano (envío, algo fuera del catálogo, un servicio): agregar o editar. */
export function LineaTextoForm({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: LineaTexto;
  alGuardar: (linea: LineaTexto) => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const formulario = useRef<HTMLFormElement>(null);
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [cantidad, setCantidad] = useState(String(inicial?.cantidad ?? 1));
  const [precio, setPrecio] = useState(inicial ? String(inicial.precioUnitario) : "");
  const [error, setError] = useState<{ campo: CampoLineaTexto; mensaje: string } | null>(null);
  const errorDe = (campo: CampoLineaTexto) => (error?.campo === campo ? error.mensaje : null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Se para el evento: si el formulario quedara dentro de otro, no debe enviarlo también.
    evento.stopPropagation();
    const linea = { descripcion: descripcion.trim(), cantidad: leerEntero(cantidad), precioUnitario: leerEntero(precio) };
    const problema = revisarLineaTexto(linea);
    if (problema) {
      flushSync(() => setError(problema));
      formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    alGuardar({ id: inicial?.id ?? `texto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...linea });
  }

  return (
    <form
      ref={formulario}
      onSubmit={enviar}
      noValidate
      aria-label={inicial ? `Editar ${inicial.descripcion}` : "Nuevo producto en texto"}
      className="space-y-4 rounded-md bg-superficie p-4"
    >
      <Campo
        id={`${id}-descripcion`}
        etiqueta="Descripción"
        ayuda="Por ejemplo: Envío a Pereira o Servicio de maquillaje."
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        maxLength={LARGO.descripcion}
        error={errorDe("descripcion")}
        autoComplete="off"
        autoFocus
      />
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-end gap-3">
        <Campo
          id={`${id}-cantidad`}
          etiqueta="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          inputMode="numeric"
          error={errorDe("cantidad")}
          autoComplete="off"
        />
        <Campo
          id={`${id}-precio`}
          etiqueta="Precio unitario"
          ayuda="En pesos. Pon 0 si no se cobra."
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          inputMode="numeric"
          error={errorDe("precioUnitario")}
          autoComplete="off"
        />
      </div>
      <p className="text-[13px] leading-[18px] text-tinta-suave">
        Se suma al total después del descuento y sale en el recibo sin referencia.
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="secundario" tamano="compacto">
          {inicial ? "Guardar cambios" : "Agregar al recibo"}
        </Boton>
        <Boton type="button" variante="fantasma" tamano="compacto" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
