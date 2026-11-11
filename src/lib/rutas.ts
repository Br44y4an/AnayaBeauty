import type { OrdenCatalogo } from "@/lib/types";

/** Hay referencias con «/», «%» y espacios: sin codificar, la ruta se parte. */
export function rutaProducto(referencia: string): string {
  return `/producto/${encodeURIComponent(referencia)}`;
}

/** El parámetro llega codificado; una secuencia rota da null (404), nunca un 500. */
export function decodificarReferencia(param: string): string | null {
  try {
    return decodeURIComponent(param);
  } catch {
    return null;
  }
}

const ORDENES: readonly OrdenCatalogo[] = ["destacados", "precio-asc", "precio-desc", "nuevos"];

/** `?orden=` llega de la URL: cualquier valor desconocido es «Recomendados». */
export function ordenDeParametro(valor: string | null | undefined): OrdenCatalogo {
  return ORDENES.find((o) => o === valor) ?? "destacados";
}

export function urlCatalogo(f: {
  categoria?: string | null;
  q?: string | null;
  orden?: OrdenCatalogo | null;
  pagina?: number | null;
}): string {
  const parametros = new URLSearchParams();
  const q = f.q?.trim();

  if (f.categoria) parametros.set("categoria", f.categoria);
  if (q) parametros.set("q", q);
  if (f.orden && f.orden !== "destacados") parametros.set("orden", f.orden);
  if (f.pagina && f.pagina > 1) parametros.set("pagina", String(Math.floor(f.pagina)));

  const texto = parametros.toString();
  return texto ? `/?${texto}` : "/";
}
