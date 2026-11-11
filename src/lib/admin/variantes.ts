import { normalizarTexto } from "@/lib/data/busqueda";
import { nombreVariante } from "@/lib/variantes";
import type { EtiquetaVariante, Variante } from "@/lib/types";

/** Una fila del editor del panel: `id` null es una variante nueva. */
export type VarianteEditable = { id: string | null; nombre: string; colorHex: string; agotado: boolean };

export type DiffVariantes = {
  insertar: Omit<Variante, "id">[];
  actualizar: Variante[];
  borrar: string[];
};

export const MAX_VARIANTES = 100;
const LARGO_MAXIMO = 60;
const HEX = /^#[0-9a-f]{6}$/i;

function cambio(antes: Variante, despues: Variante): boolean {
  return (
    antes.nombre !== despues.nombre ||
    antes.colorHex.toLowerCase() !== despues.colorHex.toLowerCase() ||
    antes.orden !== despues.orden ||
    antes.agotado !== despues.agotado
  );
}

/**
 * Qué escribir para pasar de `actuales` a `nuevas` sin borrar todo y reinsertar: los ids se conservan
 * (las bolsas guardadas los usan). El orden es la posición en `nuevas`, que es la de la foto.
 */
export function diffVariantes(actuales: Variante[], nuevas: VarianteEditable[]): DiffVariantes {
  const porId = new Map(actuales.map((v) => [v.id, v]));
  const usados = new Set<string>();
  const diff: DiffVariantes = { insertar: [], actualizar: [], borrar: [] };

  nuevas.forEach(({ id, nombre, colorHex, agotado }, orden) => {
    const actual = id ? porId.get(id) : undefined;
    if (!actual || usados.has(actual.id)) {
      diff.insertar.push({ nombre, colorHex, orden, agotado });
      return;
    }
    usados.add(actual.id);
    const final = { id: actual.id, nombre, colorHex, orden, agotado };
    if (cambio(actual, final)) diff.actualizar.push(final);
  });

  diff.borrar = actuales.filter((v) => !usados.has(v.id)).map((v) => v.id);
  return diff;
}

/**
 * `unique (product_id, nombre)` se comprueba fila por fila: si una variante toma el nombre que otra
 * todavía tiene (un intercambio), hay que pasar antes por nombres temporales.
 */
export function requiereDosPasos(actuales: Variante[], diff: DiffVariantes): boolean {
  const borradas = new Set(diff.borrar);
  const nombreActual = new Map(actuales.map((v) => [v.id, v.nombre]));
  const ocupados = new Map(actuales.filter((v) => !borradas.has(v.id)).map((v) => [v.nombre, v.id]));

  return diff.actualizar.some((v) => {
    const dueno = ocupados.get(v.nombre);
    return v.nombre !== nombreActual.get(v.id) && dueno !== undefined && dueno !== v.id;
  });
}

export type ResultadoVariantes = { ok: true; variantes: VarianteEditable[] } | { ok: false; error: string };

/** Limpia y valida lo que llega del formulario antes de escribir nada. */
export function validarVariantes(filas: VarianteEditable[], etiqueta: EtiquetaVariante): ResultadoVariantes {
  const plural = nombreVariante(etiqueta, 2);
  const limpias = filas
    .map((f) => ({ ...f, nombre: f.nombre.trim().replace(/\s+/g, " ") }))
    .filter((f) => f.nombre || f.id);

  if (limpias.length > MAX_VARIANTES) {
    return { ok: false, error: `Puedes cargar hasta ${MAX_VARIANTES} ${plural}.` };
  }

  const vistos = new Set<string>();
  for (const [i, f] of limpias.entries()) {
    if (!f.nombre) return { ok: false, error: `Falta el nombre en la fila ${i + 1}. Escríbelo o quita la fila.` };
    if (f.nombre.length > LARGO_MAXIMO) {
      return { ok: false, error: `El nombre «${f.nombre.slice(0, 20)}…» es muy largo: máximo ${LARGO_MAXIMO} caracteres.` };
    }
    if (!HEX.test(f.colorHex)) return { ok: false, error: `El color de «${f.nombre}» no es válido.` };

    const clave = normalizarTexto(f.nombre);
    if (vistos.has(clave)) {
      return { ok: false, error: `Dos ${plural} tienen el mismo nombre: «${f.nombre}». Cambia uno.` };
    }
    vistos.add(clave);
  }

  return { ok: true, variantes: limpias.map((f) => ({ ...f, colorHex: f.colorHex.toLowerCase() })) };
}
