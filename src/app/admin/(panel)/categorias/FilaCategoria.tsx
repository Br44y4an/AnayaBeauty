"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { Giro } from "@/components/ui/Giro";
import { IconoChevron } from "@/components/ui/Iconos";
import { Insignia } from "@/components/ui/Insignia";
import type { Resultado } from "@/lib/admin/resultado";
import type { CategoriaPanel } from "@/lib/data/admin-catalog";
import { cambiarVisibilidadCategoria, moverCategoria } from "./actions";
import { FormularioCategoria } from "./FormularioCategoria";

type Accion = "subir" | "bajar" | "visibilidad";

const BOTON_ICONO =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-tinta hover:bg-superficie " +
  "disabled:cursor-not-allowed disabled:text-borde disabled:hover:bg-transparent aria-busy:cursor-wait";

const productos = (n: number) => (n === 1 ? "1 producto" : `${n} productos`);
const subcategorias = (n: number) => (n === 1 ? "1 categoría" : `${n} categorías`);

/** Una categoría con su orden, su visibilidad y la edición en el sitio. */
export function FilaCategoria({
  categoria: c,
  categorias,
  posicion,
  esPrimera,
  esUltima,
  hijas = [],
  alGuardar,
}: {
  categoria: CategoriaPanel;
  categorias: CategoriaPanel[];
  /** Las de un departamento: su cuenta de productos incluye la de ellas. */
  hijas?: CategoriaPanel[];
  posicion: number;
  esPrimera: boolean;
  esUltima: boolean;
  alGuardar: (mensaje: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [enCurso, setEnCurso] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const botones: Record<Accion | "editar", RefObject<HTMLButtonElement | null>> = {
    subir: useRef(null),
    bajar: useRef(null),
    visibilidad: useRef(null),
    editar: useRef(null),
  };
  const recuperarFoco = useRef<Accion | null>(null);

  // Al moverse, la fila cambia de lugar en el DOM y el botón pierde el foco: se le devuelve.
  useEffect(() => {
    const accion = recuperarFoco.current;
    recuperarFoco.current = null;
    if (!accion || (document.activeElement && document.activeElement !== document.body)) return;
    const otra = accion === "subir" ? "bajar" : "subir";
    const destino = botones[accion].current?.disabled ? botones[otra] : botones[accion];
    destino.current?.focus();
  }, [posicion, c.activo]);

  // Mientras trabaja, los botones siguen enfocables (aria-disabled): un botón deshabilitado suelta el foco.
  function ejecutar(accion: Accion, llamar: () => Promise<Resultado>) {
    if (pendiente) return;
    setError(null);
    setEnCurso(accion);
    recuperarFoco.current = accion;
    iniciar(async () => {
      const resultado = await llamar().catch(() => null);
      if (resultado?.ok) return;
      recuperarFoco.current = null;
      setError(resultado?.error ?? "No se pudo conectar. Intenta otra vez.");
    });
  }

  const trabajando = (accion: Accion) => pendiente && enCurso === accion;
  const total = hijas.reduce((suma, h) => suma + h.numProductos, c.numProductos);
  const detalles = [
    hijas.length > 0 && subcategorias(hijas.length),
    productos(total),
    c.etiquetaVariante && `Variantes: ${c.etiquetaVariante.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p
            className={`flex flex-wrap items-center gap-2 text-[15px] leading-5 text-tinta ${
              hijas.length > 0 ? "font-semibold" : "font-medium"
            }`}
          >
            {c.nombre}
            {!c.activo && <Insignia>Oculta</Insignia>}
          </p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-tinta-suave tabular-nums">{detalles}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <div className="flex">
            {(["subir", "bajar"] as const).map((accion) => (
              <button
                key={accion}
                ref={botones[accion]}
                type="button"
                disabled={accion === "subir" ? esPrimera : esUltima}
                aria-disabled={pendiente || undefined}
                aria-busy={trabajando(accion) || undefined}
                onClick={() => ejecutar(accion, () => moverCategoria(c.id, accion === "subir" ? -1 : 1))}
                aria-label={`${accion === "subir" ? "Subir" : "Bajar"} ${c.nombre}`}
                className={BOTON_ICONO}
              >
                {trabajando(accion) ? (
                  <Giro />
                ) : (
                  <IconoChevron direccion={accion === "subir" ? "arriba" : "abajo"} tamano={20} />
                )}
              </button>
            ))}
          </div>
          <button
            ref={botones.visibilidad}
            type="button"
            aria-disabled={pendiente || undefined}
            aria-busy={trabajando("visibilidad") || undefined}
            aria-label={`${c.activo ? "Ocultar" : "Mostrar"} ${c.nombre}`}
            onClick={() => ejecutar("visibilidad", () => cambiarVisibilidadCategoria(c.id, !c.activo))}
            className={estilosBoton({ variante: "contorno", tamano: "compacto", className: "min-w-24" })}
          >
            {trabajando("visibilidad") ? <Giro /> : c.activo ? "Ocultar" : "Mostrar"}
          </button>
          <button
            ref={botones.editar}
            type="button"
            aria-expanded={editando}
            aria-controls={`editar-${c.id}`}
            aria-label={`Editar ${c.nombre}`}
            onClick={() => setEditando((abierto) => !abierto)}
            className={estilosBoton({ variante: editando ? "secundario" : "contorno", tamano: "compacto" })}
          >
            Editar
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm leading-5 text-error">
          {error}
        </p>
      )}

      <div id={`editar-${c.id}`} hidden={!editando} className="mt-4 rounded-md border border-linea p-4">
        {editando && (
          <FormularioCategoria
            categoria={c}
            categorias={categorias}
            alGuardar={(nombre) => {
              setEditando(false);
              alGuardar(`Guardaste ${nombre}.`);
              botones.editar.current?.focus();
            }}
            alCancelar={() => {
              setEditando(false);
              botones.editar.current?.focus();
            }}
          />
        )}
      </div>
    </div>
  );
}
