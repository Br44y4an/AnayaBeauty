import { describe, it, expect } from "vitest";
import { traerTodas, TAMANO_PAGINA } from "@/lib/data/paginacion";

/**
 * Regresión: el catálogo tenía `.limit(500)` fijo. Con 591 productos en la
 * tienda, 76 productos con precio desaparecían del buscador del recibo
 * manual — "aparecen algunos productos y algunos no".
 */

/** Simula PostgREST: devuelve el rango pedido, recortado por max-rows. */
function fakeTabla(filas: number[], maxRows = 1000) {
  const llamadas: [number, number][] = [];
  const consultar = async (desde: number, hasta: number) => {
    llamadas.push([desde, hasta]);
    const tope = Math.min(hasta, desde + maxRows - 1);
    return { data: filas.slice(desde, tope + 1), error: null };
  };
  return { consultar, llamadas };
}

describe("traerTodas", () => {
  it("trae las 591 filas reales de la tienda, no solo las primeras 500", async () => {
    const filas = Array.from({ length: 591 }, (_, i) => i);
    const { consultar } = fakeTabla(filas);

    const resultado = await traerTodas(consultar);

    expect(resultado).toHaveLength(591);
    expect(resultado.at(-1)).toBe(590);
  });

  it("no pierde filas cuando hay más que el max-rows del servidor", async () => {
    const filas = Array.from({ length: 2500 }, (_, i) => i);
    const { consultar } = fakeTabla(filas, 1000);

    const resultado = await traerTodas(consultar);

    expect(resultado).toHaveLength(2500);
    expect(resultado).toEqual(filas);
  });

  it("para en la primera página cuando la tabla es pequeña", async () => {
    const filas = Array.from({ length: 3 }, (_, i) => i);
    const { consultar, llamadas } = fakeTabla(filas);

    const resultado = await traerTodas(consultar);

    expect(resultado).toEqual([0, 1, 2]);
    expect(llamadas).toHaveLength(1);
  });

  it("devuelve vacío sin reventar cuando no hay filas", async () => {
    const { consultar, llamadas } = fakeTabla([]);
    await expect(traerTodas(consultar)).resolves.toEqual([]);
    expect(llamadas).toHaveLength(1);
  });

  it("pide páginas del tamaño acordado", async () => {
    const filas = Array.from({ length: TAMANO_PAGINA + 5 }, (_, i) => i);
    const { consultar, llamadas } = fakeTabla(filas);

    await traerTodas(consultar);

    expect(llamadas[0]).toEqual([0, TAMANO_PAGINA - 1]);
    expect(llamadas[1]).toEqual([TAMANO_PAGINA, TAMANO_PAGINA * 2 - 1]);
  });

  it("propaga el error de la base en vez de devolver una lista incompleta", async () => {
    const consultar = async () => ({ data: null, error: { message: "conexión caída" } });
    await expect(traerTodas(consultar)).rejects.toThrow("conexión caída");
  });

  it("no se cuelga en un bucle infinito si el servidor deja de devolver filas", async () => {
    let paginas = 0;
    const consultar = async () => {
      paginas++;
      return { data: [], error: null };
    };
    await expect(traerTodas(consultar)).resolves.toEqual([]);
    expect(paginas).toBe(1);
  });
});
