import { obtenerDatosBolsa } from "@/lib/data/bolsa";
import { esUuid } from "@/lib/ids";

/** Una bolsa real no pasa de 40 líneas; esto solo frena abusos. */
const MAX_IDS = 60;

/** Stock, precios y variantes de ahora mismo: nunca sale de una caché. */
export async function GET(request: Request) {
  const crudos = new URL(request.url).searchParams.get("ids")?.split(",") ?? [];
  const ids = [...new Set(crudos.map((id) => id.trim()).filter(esUuid))].slice(0, MAX_IDS);

  return Response.json(await obtenerDatosBolsa(ids), {
    headers: { "Cache-Control": "no-store" },
  });
}
