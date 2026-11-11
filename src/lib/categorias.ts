import type { Categoria } from "@/lib/types";

export type Departamento = Categoria & { hijas: Categoria[] };

const porOrden = (a: Categoria, b: Categoria) =>
  a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");

/**
 * La raíz de una categoría dentro de la lista. Una hija cuyo padre no está
 * (oculto o borrado) es su propia raíz; el tope de pasos corta un ciclo.
 */
function raizDe(categoria: Categoria, porId: Map<string, Categoria>): Categoria {
  let actual = categoria;
  for (let pasos = 0; pasos < 10; pasos++) {
    const padre = actual.categoriaPadreId ? porId.get(actual.categoriaPadreId) : undefined;
    if (!padre || padre === categoria) return actual;
    actual = padre;
  }
  return actual;
}

export function arbolDeCategorias(categorias: Categoria[]): Departamento[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const hijas = new Map<string, Categoria[]>();
  const raices: Categoria[] = [];

  for (const c of categorias) {
    const raiz = raizDe(c, porId);
    if (raiz === c) raices.push(c);
    else hijas.set(raiz.id, [...(hijas.get(raiz.id) ?? []), c]);
  }

  return raices
    .sort(porOrden)
    .map((raiz) => ({ ...raiz, hijas: (hijas.get(raiz.id) ?? []).sort(porOrden) }));
}

/** La categoría y todo lo que cuelga de ella; null si el slug no existe. */
export function idsDeCategoria(slug: string, categorias: Categoria[]): string[] | null {
  const elegida = categorias.find((c) => c.slug === slug);
  if (!elegida) return null;

  const departamento = arbolDeCategorias(categorias).find((d) => d.id === elegida.id);
  return [elegida.id, ...(departamento?.hijas.map((h) => h.id) ?? [])];
}

export function departamentoDe(categoriaId: string | null, categorias: Categoria[]): Categoria | null {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const categoria = categoriaId ? porId.get(categoriaId) : undefined;
  return categoria ? raizDe(categoria, porId) : null;
}
