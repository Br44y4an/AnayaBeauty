import { describe, it, expect, vi, beforeEach } from "vitest";

const datos = vi.hoisted(() => ({ obtenerProductos: vi.fn(), obtenerSugerencias: vi.fn() }));
vi.mock("@/lib/data/catalogo", () => datos);

import { GET as getCatalogo } from "@/app/api/catalogo/route";
import { GET as getBuscar } from "@/app/api/buscar/route";

const PAGINA = { productos: [], total: 0, pagina: 2, porPagina: 24 };
const SUGERENCIAS = { total: 1, productos: [{ referencia: "USK-621" }] };
const CACHE_PUBLICA = "public, s-maxage=60, stale-while-revalidate=300";

beforeEach(() => {
  datos.obtenerProductos.mockReset().mockResolvedValue(PAGINA);
  datos.obtenerSugerencias.mockReset().mockResolvedValue(SUGERENCIAS);
});

describe("GET /api/catalogo", () => {
  it("pasa los filtros de la URL y deja que la CDN lo guarde un minuto", async () => {
    const respuesta = await getCatalogo(
      new Request("http://localhost/api/catalogo?categoria=labios&q=rojo&orden=precio-asc&pagina=2")
    );

    expect(datos.obtenerProductos).toHaveBeenCalledWith({
      categoriaSlug: "labios",
      busqueda: "rojo",
      orden: "precio-asc",
      pagina: 2,
    });
    expect(respuesta.headers.get("Cache-Control")).toBe(CACHE_PUBLICA);
    expect(await respuesta.json()).toEqual(PAGINA);
  });

  it("un orden o una página inventados vuelven a los valores por defecto", async () => {
    await getCatalogo(new Request("http://localhost/api/catalogo?orden=hackeo&pagina=abc"));

    expect(datos.obtenerProductos).toHaveBeenCalledWith({
      categoriaSlug: null,
      busqueda: null,
      orden: "destacados",
      pagina: 1,
    });
  });
});

describe("GET /api/buscar", () => {
  it("pide las sugerencias del texto y deja que la CDN lo guarde un minuto", async () => {
    const respuesta = await getBuscar(new Request("http://localhost/api/buscar?q=usk%20621"));

    expect(datos.obtenerSugerencias).toHaveBeenCalledWith("usk 621");
    expect(respuesta.headers.get("Cache-Control")).toBe(CACHE_PUBLICA);
    expect(await respuesta.json()).toEqual(SUGERENCIAS);
  });

  it("sin texto pide sugerencias de nada, sin fallar", async () => {
    await getBuscar(new Request("http://localhost/api/buscar"));
    expect(datos.obtenerSugerencias).toHaveBeenCalledWith("");
  });
});
