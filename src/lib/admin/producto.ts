import { esUuid } from "@/lib/ids";
import { ETIQUETAS_VARIANTE } from "@/lib/variantes";
import { validarVariantes, type VarianteEditable } from "@/lib/admin/variantes";
import type { Escalon } from "@/lib/pricing";
import type { EtiquetaVariante } from "@/lib/types";

/** El formulario del panel ya limpio y validado, listo para escribir. */
export type ProductoFormulario = {
  id: string | null;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  stock: number;
  categoriaId: string | null;
  etiquetaVariante: EtiquetaVariante | null;
  activo: boolean;
  destacado: boolean;
  imagenPrincipal: string | null;
  escalones: Escalon[];
  variantes: VarianteEditable[];
};

export type LecturaProducto =
  | { ok: true; producto: ProductoFormulario }
  | { ok: false; error: string; campos?: Record<string, string> };

const MAX_ESCALONES = 10;
const PRECIO_MAXIMO = 10_000_000;
const STOCK_MAXIMO = 100_000;

const texto = (datos: FormData, clave: string) => String(datos.get(clave) ?? "").trim();
const esEntero = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function etiquetaDe(valor: string): EtiquetaVariante | null {
  return ETIQUETAS_VARIANTE.find((e) => e === valor) ?? null;
}

function leerJson(datos: FormData, clave: string): unknown {
  try {
    return JSON.parse(String(datos.get(clave) ?? "[]"));
  } catch {
    return null;
  }
}

/** Devuelve los escalones ordenados o el texto del error. */
function leerEscalones(crudo: unknown): Escalon[] | string {
  const forma = Array.isArray(crudo) && crudo.every((e) => typeof e === "object" && e !== null);
  if (!forma || crudo.length > MAX_ESCALONES) return "Los precios no son válidos. Recarga la página.";

  const escalones: Escalon[] = [];
  for (const { minCantidad, precioUnitario } of crudo as Record<string, unknown>[]) {
    if (!esEntero(minCantidad, 1, 1000)) return "Cada precio necesita una cantidad mínima de 1 o más.";
    if (precioUnitario === null || precioUnitario === undefined || precioUnitario === "") {
      return `Escribe el precio desde ${minCantidad} unidades o quita esa fila.`;
    }
    if (!esEntero(precioUnitario, 1, PRECIO_MAXIMO)) return `El precio desde ${minCantidad} unidades no es válido.`;
    escalones.push({ minCantidad, precioUnitario });
  }

  if (!escalones.some((e) => e.minCantidad === 1)) {
    return "Falta el precio de 1 unidad: sin él no se puede vender una sola.";
  }
  if (new Set(escalones.map((e) => e.minCantidad)).size !== escalones.length) {
    return "Hay dos precios con la misma cantidad mínima.";
  }
  return escalones.sort((a, b) => a.minCantidad - b.minCantidad);
}

function leerVariantes(crudo: unknown): VarianteEditable[] | null {
  if (!Array.isArray(crudo)) return null;
  const validas = crudo.every(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      (v.id === null || typeof v.id === "string") &&
      typeof v.nombre === "string" &&
      typeof v.colorHex === "string" &&
      typeof v.agotado === "boolean"
  );
  return validas ? crudo.map(({ id, nombre, colorHex, agotado }) => ({ id, nombre, colorHex, agotado })) : null;
}

/**
 * Lee y valida todo el formulario de producto antes de la primera escritura. Una foto solo se acepta
 * si está en el bucket (`prefijoFotos`) o si es la que el producto ya tenía.
 */
export function leerFormularioProducto(
  datos: FormData,
  { prefijoFotos, imagenActual }: { prefijoFotos: string; imagenActual: string | null }
): LecturaProducto {
  const campos: Record<string, string> = {};

  const id = texto(datos, "id") || null;
  if (id !== null && !esUuid(id)) return { ok: false, error: "Este producto no es válido. Vuelve a la lista." };

  const referencia = texto(datos, "referencia").toUpperCase();
  if (!referencia) campos.referencia = "Escribe la referencia.";
  else if (referencia.length > 40) campos.referencia = "La referencia es muy larga: máximo 40 caracteres.";

  const nombre = texto(datos, "nombre").replace(/\s+/g, " ");
  if (!nombre) campos.nombre = "Escribe el nombre.";
  else if (nombre.length > 120) campos.nombre = "El nombre es muy largo: máximo 120 caracteres.";

  const descripcion = texto(datos, "descripcion") || null;
  if (descripcion && descripcion.length > 1000) campos.descripcion = "La descripción es muy larga: máximo 1.000 caracteres.";

  const stockTexto = texto(datos, "stock");
  const stock = /^\d+$/.test(stockTexto) ? Number(stockTexto) : NaN;
  if (!esEntero(stock, 0, STOCK_MAXIMO)) campos.stock = "Escribe cuántas unidades hay: 0 o más.";

  const categoriaId = texto(datos, "category_id") || null;
  if (categoriaId !== null && !esUuid(categoriaId)) campos.category_id = "Elige una categoría de la lista.";

  const etiquetaTexto = texto(datos, "etiqueta_variante");
  const etiquetaVariante = etiquetaDe(etiquetaTexto);
  if (etiquetaTexto && !etiquetaVariante) campos.etiqueta_variante = "Elige una de las opciones de la lista.";

  const imagenPrincipal = texto(datos, "imagen_principal") || null;
  const fotoPropia = imagenPrincipal !== null && imagenPrincipal.startsWith(prefijoFotos) && imagenPrincipal.length < 500;
  if (imagenPrincipal && !fotoPropia && imagenPrincipal !== imagenActual) {
    campos.imagen_principal = "La foto debe subirse desde este formulario.";
  }

  const escalones = leerEscalones(leerJson(datos, "escalones"));
  if (typeof escalones === "string") campos.escalones = escalones;

  const etiqueta = etiquetaDe(texto(datos, "etiqueta_efectiva")) ?? "Tono";
  const crudas = leerVariantes(leerJson(datos, "variantes"));
  const variantes = crudas ? validarVariantes(crudas, etiqueta) : null;
  if (!variantes) campos.variantes = "Las variantes no son válidas. Recarga la página.";
  else if (!variantes.ok) campos.variantes = variantes.error;

  if (Object.keys(campos).length > 0 || typeof escalones === "string" || !variantes?.ok) {
    return { ok: false, error: "Revisa los campos marcados.", campos };
  }

  return {
    ok: true,
    producto: {
      id,
      referencia,
      nombre,
      descripcion,
      stock,
      categoriaId,
      etiquetaVariante,
      activo: datos.get("activo") === "on",
      destacado: datos.get("destacado") === "on",
      imagenPrincipal,
      escalones,
      variantes: variantes.variantes,
    },
  };
}
