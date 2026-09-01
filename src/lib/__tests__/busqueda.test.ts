import { describe, it, expect } from "vitest";
import { filtroBusqueda } from "@/lib/data/busqueda";

/**
 * Regresión: el término del buscador se metía crudo en el filtro `or()` de
 * PostgREST. Como la coma es el separador entre condiciones, buscar
 * "base, matte" rompía el árbol lógico, la consulta fallaba y la página
 * reventaba con "Minified React error #441" (error 500 en el servidor).
 */
describe("filtroBusqueda", () => {
  it("deja la coma dentro del valor, sin partir el filtro en dos condiciones", () => {
    const filtro = filtroBusqueda("base, matte");

    // Cada condición va entrecomillada: las comas de dentro ya no separan.
    expect(filtro).toBe('nombre.ilike."%base, matte%",referencia.ilike."%base, matte%"');
  });

  it("arma una condición por columna", () => {
    expect(filtroBusqueda("labial")).toBe(
      'nombre.ilike."%labial%",referencia.ilike."%labial%"'
    );
  });

  it("escapa las comillas dobles para que no cierren el valor antes de tiempo", () => {
    expect(filtroBusqueda('vidrio 5" alto')).toBe(
      'nombre.ilike."%vidrio 5\\" alto%",referencia.ilike."%vidrio 5\\" alto%"'
    );
  });

  it("escapa la barra invertida antes que las comillas", () => {
    // Una sola barra escaparía la comilla siguiente y rompería el filtro.
    expect(filtroBusqueda("a\\b")).toBe(
      'nombre.ilike."%a\\\\b%",referencia.ilike."%a\\\\b%"'
    );
    expect(filtroBusqueda('a\\"b')).toBe(
      'nombre.ilike."%a\\\\\\"b%",referencia.ilike."%a\\\\\\"b%"'
    );
  });

  it("recorta los espacios de los extremos", () => {
    expect(filtroBusqueda("  labial  ")).toBe(
      'nombre.ilike."%labial%",referencia.ilike."%labial%"'
    );
  });

  it("no se rompe con los caracteres del propio lenguaje de PostgREST", () => {
    for (const termino of ["(a,b).c", "nombre.ilike", "a.or.b", "()", "*", "%", "_"]) {
      const filtro = filtroBusqueda(termino);
      expect(filtro.startsWith('nombre.ilike."%')).toBe(true);
      expect(filtro).toContain('referencia.ilike."%');
    }
  });

  it("acepta la lista de columnas a consultar", () => {
    expect(filtroBusqueda("x", ["nombre"])).toBe('nombre.ilike."%x%"');
  });
});
