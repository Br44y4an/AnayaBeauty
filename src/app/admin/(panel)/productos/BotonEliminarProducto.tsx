"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/Boton";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { urlListaProductos, type EstadoLista } from "@/lib/admin/filtros";
import { eliminarProducto } from "./actions";

/** Borrar es definitivo: vive solo dentro de la ficha del producto y pide confirmación en el sitio. */
export function BotonEliminarProducto({ id, nombre, lista }: { id: string; nombre: string; lista: EstadoLista }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, iniciar] = useTransition();
  const botonEliminar = useRef<HTMLDivElement>(null);
  const botonCancelar = useRef<HTMLDivElement>(null);

  function preguntar(si: boolean) {
    flushSync(() => {
      setConfirmando(si);
      setError(null);
    });
    (si ? botonCancelar : botonEliminar).current?.querySelector("button")?.focus();
  }

  function eliminar() {
    setError(null);
    iniciar(async () => {
      const resultado = await eliminarProducto(id).catch(() => null);
      if (resultado?.ok) router.push(urlListaProductos(lista, { eliminado: resultado.referencia }));
      else setError(resultado?.error ?? "No se pudo conectar. Revisa tu internet e intenta otra vez.");
    });
  }

  return (
    <section aria-labelledby="eliminar-titulo" className="space-y-3 border-t border-linea pt-6">
      <h2 id="eliminar-titulo" className="text-xl font-semibold leading-[26px] text-tinta">
        Eliminar producto
      </h2>
      <p className="text-[15px] leading-6 text-tinta-suave">
        Se borra para siempre, con sus precios y variantes. Los pedidos que ya lo tienen no cambian. Si solo
        quieres sacarlo de la tienda, apaga «Visible en la tienda».
      </p>

      {confirmando ? (
        <div role="group" aria-labelledby="eliminar-pregunta" className="space-y-3 rounded-md border border-error p-4">
          <p id="eliminar-pregunta" className="text-[15px] font-semibold leading-6 text-tinta">
            ¿Eliminar {nombre}?
          </p>
          <div className="flex flex-wrap gap-3">
            <Boton type="button" variante="peligro" tamano="compacto" cargando={eliminando} onClick={eliminar}>
              {eliminando ? "Eliminando…" : "Sí, eliminar"}
            </Boton>
            <div ref={botonCancelar}>
              <Boton type="button" variante="fantasma" tamano="compacto" disabled={eliminando} onClick={() => preguntar(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        </div>
      ) : (
        <div ref={botonEliminar}>
          <Boton type="button" variante="peligro" tamano="compacto" onClick={() => preguntar(true)}>
            Eliminar producto
          </Boton>
        </div>
      )}

      {error && <AvisoPanel tono="error">{error}</AvisoPanel>}
    </section>
  );
}
