"use client";

import { useId, useMemo, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { IconoMas } from "@/components/ui/Iconos";
import { Stepper } from "@/components/ui/Stepper";
import { CampoLista } from "@/components/admin/CamposPanel";
import { pesos } from "@/lib/format";
import { precioUnitarioPara } from "@/lib/pricing";
import type { Producto } from "@/lib/types";
import type { LineaCatalogo } from "./estadoRecibo";

/** Buscar un producto del catálogo por nombre o referencia, elegir la variante y la cantidad. */
export function BuscadorProducto({
  productos,
  alAgregar,
}: {
  productos: Producto[];
  alAgregar: (linea: LineaCatalogo) => void;
}) {
  const id = useId();
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [tonoId, setTonoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const variantes = elegido?.variantes ?? [];

  const sugerencias = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(termino) || p.referencia.toLowerCase().includes(termino))
      .slice(0, 8);
  }, [busqueda, productos]);

  function agregar() {
    if (!elegido) return;
    const tono = variantes.find((t) => t.id === tonoId) ?? null;
    if (variantes.length > 0 && !tono) return;
    alAgregar({ productoId: elegido.id, tonoId: tono?.id ?? null, tonoNombre: tono?.nombre ?? null, cantidad });
    setElegido(null);
    setTonoId("");
    setCantidad(1);
    setBusqueda("");
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Campo
          id={`${id}-buscar`}
          etiqueta="Agregar del catálogo"
          ayuda="Busca por nombre o referencia."
          type="search"
          autoComplete="off"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setElegido(null);
          }}
        />
        {sugerencias.length > 0 && !elegido && (
          <ul className="absolute z-10 mt-1 w-full rounded-md bg-fondo p-1 shadow-flotante ring-1 ring-linea">
            {sugerencias.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setElegido(p);
                    setBusqueda(`${p.referencia} · ${p.nombre}`);
                  }}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 text-left text-[15px] text-tinta hover:bg-superficie"
                >
                  <span className="truncate">
                    <span className="font-semibold text-tinta-suave">{p.referencia}</span> {p.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums text-tinta-suave">{pesos(precioUnitarioPara(p.escalones, 1))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {elegido && (
        <div className="flex flex-wrap items-end gap-3">
          {variantes.length > 0 && (
            <CampoLista
              id={`${id}-variante`}
              etiqueta={elegido.etiquetaVariante}
              className="min-w-40 flex-1"
              value={tonoId}
              onChange={(e) => setTonoId(e.target.value)}
            >
              <option value="">Elige…</option>
              {variantes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </CampoLista>
          )}
          <Stepper valor={cantidad} min={1} max={999} onCambiar={setCantidad} etiqueta={elegido.nombre} />
          <Boton
            type="button"
            variante="secundario"
            tamano="compacto"
            onClick={agregar}
            disabled={variantes.length > 0 && !tonoId}
          >
            <IconoMas tamano={20} /> Agregar
          </Boton>
        </div>
      )}
    </div>
  );
}
