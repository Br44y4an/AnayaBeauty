"use client";

import { useRef, useState } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoMas } from "@/components/ui/Iconos";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { arbolDeCategorias } from "@/lib/categorias";
import type { CategoriaPanel } from "@/lib/data/admin-catalog";
import { FilaCategoria } from "./FilaCategoria";
import { FormularioCategoria } from "./FormularioCategoria";

/** Departamentos con sus categorías, en el orden de las pestañas de la tienda. */
export function EditorCategorias({ categorias }: { categorias: CategoriaPanel[] }) {
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const botonNueva = useRef<HTMLButtonElement>(null);

  const porId = new Map(categorias.map((c) => [c.id, c]));
  const arbol = arbolDeCategorias(categorias).map((d) => ({
    categoria: porId.get(d.id)!,
    hijas: d.hijas.map((h) => porId.get(h.id)!),
  }));

  const fila = (c: CategoriaPanel, posicion: number, total: number, hijas?: CategoriaPanel[]) => (
    <FilaCategoria
      categoria={c}
      categorias={categorias}
      posicion={posicion}
      esPrimera={posicion === 0}
      esUltima={posicion === total - 1}
      hijas={hijas}
      alGuardar={setAviso}
    />
  );

  return (
    <div className="space-y-6">
      {aviso && (
        <AvisoPanel tono="exito" className="animate-aparecer">
          {aviso}
        </AvisoPanel>
      )}

      {creando ? (
        <section aria-labelledby="nueva-titulo" className="rounded-md border border-linea p-4">
          <h2 id="nueva-titulo" className="mb-4 text-xl font-semibold leading-[26px] text-tinta">
            Nueva categoría
          </h2>
          <FormularioCategoria
            categoria={null}
            categorias={categorias}
            alGuardar={(nombre) => {
              setCreando(false);
              setAviso(`Agregaste ${nombre}. Quedó al final de su nivel.`);
              requestAnimationFrame(() => botonNueva.current?.focus());
            }}
            alCancelar={() => {
              setCreando(false);
              requestAnimationFrame(() => botonNueva.current?.focus());
            }}
          />
        </section>
      ) : (
        <button
          ref={botonNueva}
          type="button"
          onClick={() => {
            setAviso(null);
            setCreando(true);
          }}
          className={estilosBoton({ variante: "contorno", tamano: "compacto" })}
        >
          <IconoMas tamano={20} />
          Nueva categoría
        </button>
      )}

      {arbol.length === 0 ? (
        <p className="py-12 text-center text-tinta-suave">Aún no hay categorías. Crea la primera.</p>
      ) : (
        <ul aria-label="Categorías" className="divide-y divide-linea border-y border-linea">
          {arbol.map(({ categoria, hijas }, i) => (
            <li key={categoria.id}>
              {fila(categoria, i, arbol.length, hijas)}
              {hijas.length > 0 && (
                <ul aria-label={`Dentro de ${categoria.nombre}`} className="mb-3 ml-3 border-l-2 border-linea pl-4">
                  {hijas.map((h, j) => (
                    <li key={h.id} className="border-t border-linea first:border-t-0">
                      {fila(h, j, hijas.length)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
