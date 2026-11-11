import { normalizarTexto } from "@/lib/data/busqueda";
import { generarSlug } from "@/lib/slug";
import { pesos } from "@/lib/format";
import type { FilaCSV } from "@/lib/csv";
import type { Escalon } from "@/lib/pricing";
import type { Categoria, Producto } from "@/lib/types";

/** Columnas que el importador puede cambiar en un producto existente. Nunca `activo`. */
export type CamposImportados = {
  nombre?: string;
  descripcion?: string | null;
  category_id?: string | null;
  stock?: number;
  /** Solo los escalones que cambian o se agregan; los demás quedan como están. */
  escalones?: Escalon[];
};

export type CambioImportacion = {
  referencia: string;
  id: string;
  campos: CamposImportados;
  /** Los valores de antes de esos mismos campos, para el resumen previo. */
  antes: CamposImportados;
};

export type PlanImportacion = {
  nuevos: FilaCSV[];
  cambios: CambioImportacion[];
  sinCambios: number;
  avisos: string[];
};

/** Por nombre (sin mayúsculas ni tildes) o por slug; null si no existe. */
export function idDeCategoria(nombre: string, categorias: Categoria[]): string | null {
  const buscado = nombre.trim();
  if (!buscado) return null;
  const slug = generarSlug(buscado);
  const normal = normalizarTexto(buscado);
  return categorias.find((c) => c.slug === slug || normalizarTexto(c.nombre) === normal)?.id ?? null;
}

function precioDe(escalones: Escalon[], minCantidad: number): number | undefined {
  return escalones.find((e) => e.minCantidad === minCantidad)?.precioUnitario;
}

/** Los mismos topes que el formulario del panel. */
function textoDemasiadoLargo(f: FilaCSV): string | null {
  if (f.referencia.length > 40) return "la referencia pasa de 40 caracteres";
  if ((f.nombre?.length ?? 0) > 120) return "el nombre pasa de 120 caracteres";
  if ((f.descripcion?.length ?? 0) > 1000) return "la descripción pasa de 1.000 caracteres";
  return null;
}

/** Los escalones como quedarían: los del producto con los del archivo encima. */
function combinar(actuales: Escalon[], nuevos: Escalon[]): Escalon[] {
  const porMinimo = new Map(actuales.map((e) => [e.minCantidad, e.precioUnitario]));
  for (const e of nuevos) porMinimo.set(e.minCantidad, e.precioUnitario);
  return [...porMinimo].map(([minCantidad, precioUnitario]) => ({ minCantidad, precioUnitario }));
}

/**
 * Qué haría el archivo, sin escribir nada. En una referencia existente solo cuentan las celdas con
 * valor que cambian algo: una celda vacía nunca borra ni pone en 0, y `activo` no se toca.
 * `existentes` va por referencia en mayúsculas, igual que las filas del CSV.
 */
export function planImportacion(
  filas: FilaCSV[],
  existentes: Map<string, Producto>,
  categorias: Categoria[] = []
): PlanImportacion {
  const plan: PlanImportacion = { nuevos: [], cambios: [], sinCambios: 0, avisos: [] };
  const avisar = (f: FilaCSV, texto: string) => plan.avisos.push(`Línea ${f.linea} (${f.referencia}): ${texto}`);

  const ultimas = new Map<string, FilaCSV>();
  for (const f of filas) {
    const previa = ultimas.get(f.referencia);
    if (previa) avisar(f, `la referencia ya venía en la línea ${previa.linea}; se usa esta fila.`);
    ultimas.set(f.referencia, f);
  }

  const revisarPrecios = (f: FilaCSV, escalones: Escalon[]) => {
    const uno = precioDe(escalones, 1);
    for (const e of escalones) {
      if (uno !== undefined && e.minCantidad > 1 && e.precioUnitario > uno) {
        avisar(
          f,
          `el precio desde ${e.minCantidad} unidades (${pesos(e.precioUnitario)}) queda más caro que el de 1 (${pesos(uno)}).`
        );
      }
    }
  };

  for (const f of ultimas.values()) {
    const largo = textoDemasiadoLargo(f);
    if (largo) {
      avisar(f, `${largo}; no se importa.`);
      continue;
    }
    const categoriaId = f.categoria ? idDeCategoria(f.categoria, categorias) : null;
    const p = existentes.get(f.referencia);

    if (!p) {
      if (!f.nombre) {
        avisar(f, "es nueva y le falta el nombre; no se crea.");
      } else if (precioDe(f.escalones, 1) === undefined) {
        avisar(f, "es nueva y le falta precio_1, el precio de 1 unidad; no se crea.");
      } else {
        if (f.categoria && !categoriaId) avisar(f, `no existe la categoría «${f.categoria}»; se crea sin categoría.`);
        revisarPrecios(f, f.escalones);
        plan.nuevos.push(f);
      }
      continue;
    }

    const campos: CamposImportados = {};
    const antes: CamposImportados = {};

    if (f.nombre && f.nombre !== p.nombre) {
      campos.nombre = f.nombre;
      antes.nombre = p.nombre;
    }
    if (f.descripcion && f.descripcion !== (p.descripcion ?? "")) {
      campos.descripcion = f.descripcion;
      antes.descripcion = p.descripcion;
    }
    if (f.categoria && !categoriaId) {
      avisar(f, `no existe la categoría «${f.categoria}»; se deja la que tenía.`);
    } else if (categoriaId && categoriaId !== p.categoriaId) {
      campos.category_id = categoriaId;
      antes.category_id = p.categoriaId;
    }
    if (f.stock !== null && f.stock !== p.stock) {
      campos.stock = f.stock;
      antes.stock = p.stock;
    }

    const precios = f.escalones.filter((e) => precioDe(p.escalones, e.minCantidad) !== e.precioUnitario);
    if (precios.length > 0) {
      campos.escalones = precios;
      antes.escalones = p.escalones.filter((e) => precios.some((n) => n.minCantidad === e.minCantidad));
      revisarPrecios(f, combinar(p.escalones, precios));
    }

    if (Object.keys(campos).length === 0) plan.sinCambios++;
    else plan.cambios.push({ referencia: f.referencia, id: p.id, campos, antes });
  }

  return plan;
}

const LARGO_RESUMEN = 60;

function recortar(texto: string): string {
  return texto.length <= LARGO_RESUMEN ? texto : `${texto.slice(0, LARGO_RESUMEN).replace(/\s+\S*$/, "")}…`;
}

const rotuloPrecio = (minCantidad: number) =>
  minCantidad === 1 ? "Precio de 1 unidad" : `Precio desde ${minCantidad}`;

/** Una línea por campo, para que la dueña vea qué cambia antes de confirmar. */
export function describirCambio(cambio: CambioImportacion, categorias: Categoria[]): string[] {
  const { campos, antes } = cambio;
  const categoria = (id: string | null | undefined) =>
    (id && categorias.find((c) => c.id === id)?.nombre) || "Sin categoría";
  const lineas: string[] = [];

  if (campos.nombre !== undefined) lineas.push(`Nombre: «${antes.nombre ?? ""}» → «${campos.nombre}»`);
  if (campos.descripcion) lineas.push(`Descripción: «${recortar(campos.descripcion)}»`);
  if (campos.category_id !== undefined) {
    lineas.push(`Categoría: ${categoria(antes.category_id)} → ${categoria(campos.category_id)}`);
  }
  if (campos.stock !== undefined) lineas.push(`Stock: ${antes.stock ?? 0} → ${campos.stock}`);
  for (const e of campos.escalones ?? []) {
    const previo = antes.escalones?.find((a) => a.minCantidad === e.minCantidad);
    lineas.push(
      previo
        ? `${rotuloPrecio(e.minCantidad)}: ${pesos(previo.precioUnitario)} → ${pesos(e.precioUnitario)}`
        : `${rotuloPrecio(e.minCantidad)}: nuevo, ${pesos(e.precioUnitario)}`
    );
  }
  return lineas;
}

/** Lo que más conviene revisar: productos con precios nuevos y los que quedarían en 0 unidades. */
export function cifrasDelPlan(plan: PlanImportacion): { cambianPrecio: number; quedanSinStock: number } {
  return {
    cambianPrecio: plan.cambios.filter((c) => c.campos.escalones).length,
    quedanSinStock: plan.cambios.filter((c) => c.campos.stock === 0).length,
  };
}
