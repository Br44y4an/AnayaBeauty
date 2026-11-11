import { describe, it, expect } from "vitest";
import { decodificarReferencia, ordenDeParametro, rutaProducto, urlCatalogo } from "@/lib/rutas";

describe("rutaProducto", () => {
  it("codifica la barra, que si no parte la ruta en dos", () => {
    expect(rutaProducto("AC80/150")).toBe("/producto/AC80%2F150");
  });

  it("codifica el % y los espacios", () => {
    expect(rutaProducto("100%")).toBe("/producto/100%25");
    expect(rutaProducto("A05 ESPEJO")).toBe("/producto/A05%20ESPEJO");
  });
});

describe("decodificarReferencia", () => {
  it("deshace la codificación una sola vez", () => {
    expect(decodificarReferencia("AC80%2F150")).toBe("AC80/150");
  });

  it("ida y vuelta conserva la referencia original", () => {
    for (const referencia of ["100%", "AC80/150", "A05 ESPEJO", "GLS735"]) {
      const segmento = rutaProducto(referencia).slice("/producto/".length);
      expect(decodificarReferencia(segmento)).toBe(referencia);
    }
  });

  it("devuelve null ante una secuencia rota en vez de lanzar", () => {
    expect(decodificarReferencia("100%")).toBeNull();
    expect(decodificarReferencia("%E0%A4%A")).toBeNull();
  });
});

describe("urlCatalogo", () => {
  it("omite el orden por defecto y la primera página", () => {
    expect(urlCatalogo({ categoria: "labios", orden: "destacados", pagina: 1 })).toBe(
      "/?categoria=labios"
    );
  });

  it("codifica la búsqueda y conserva la página", () => {
    expect(urlCatalogo({ q: "usk 621", pagina: 3 })).toBe("/?q=usk+621&pagina=3");
  });

  it("sin filtros es la portada", () => {
    expect(urlCatalogo({})).toBe("/");
    expect(urlCatalogo({ q: "   ", categoria: null, orden: null, pagina: null })).toBe("/");
  });

  it("combina todos los filtros en un orden fijo", () => {
    expect(
      urlCatalogo({ q: "rojo", orden: "precio-asc", categoria: "labios", pagina: 2 })
    ).toBe("/?categoria=labios&q=rojo&orden=precio-asc&pagina=2");
  });
});

describe("ordenDeParametro", () => {
  it("acepta los órdenes conocidos", () => {
    expect(ordenDeParametro("precio-asc")).toBe("precio-asc");
    expect(ordenDeParametro("nuevos")).toBe("nuevos");
  });

  it("cualquier otra cosa vuelve a Recomendados", () => {
    expect(ordenDeParametro("precio")).toBe("destacados");
    expect(ordenDeParametro(null)).toBe("destacados");
    expect(ordenDeParametro(undefined)).toBe("destacados");
  });
});
