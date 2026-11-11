import { obtenerProductos } from "@/lib/data/catalogo";
import { ordenDeParametro } from "@/lib/rutas";

/** «Ver más productos»: una lectura por GET que la CDN puede guardar un minuto. */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;

  const datos = await obtenerProductos({
    categoriaSlug: parametros.get("categoria"),
    busqueda: parametros.get("q"),
    orden: ordenDeParametro(parametros.get("orden")),
    pagina: Number(parametros.get("pagina")) || 1,
  });

  return Response.json(datos, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
