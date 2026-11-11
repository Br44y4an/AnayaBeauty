import { obtenerSugerencias } from "@/lib/data/catalogo";

/** Sugerencias de la búsqueda rápida: hasta 8, con la referencia exacta primero. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";

  return Response.json(await obtenerSugerencias(q), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
