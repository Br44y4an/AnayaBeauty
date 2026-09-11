import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contraste, luminancia, cumpleAA, AA_NORMAL } from "@/lib/color";

/**
 * Vigilancia de la paleta.
 *
 * Esta prueba NO usa constantes copiadas a mano: lee `globals.css` y
 * comprueba los colores que la web está usando de verdad. Si alguien
 * "aviva" el rosa de la marca para que se vea más bonito, la prueba se
 * cae y dice exactamente cuánto contraste perdió.
 *
 * Hace falta porque el fallo era invisible desde el código: el rosa
 * original (#e5308a) se veía precioso en la pantalla del que lo eligió y
 * quedaba en 4.10:1 — por debajo del 4.5:1 de WCAG AA — tanto como texto
 * sobre blanco como con texto blanco encima, que es como está el botón
 * principal de toda la tienda.
 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function token(nombre: string): string {
  const encontrado = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!encontrado) throw new Error(`No existe el token --color-${nombre} en globals.css`);
  return encontrado[1];
}

const PETALO = () => token("petalo");
const ROSA_NUBE = () => token("rosa-nube");

describe("color · utilidades", () => {
  it("calcula la luminancia de los extremos", () => {
    expect(luminancia("#000000")).toBeCloseTo(0);
    expect(luminancia("#ffffff")).toBeCloseTo(1);
  });

  it("da 21 entre negro y blanco, y 1 entre un color y sí mismo", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#d11a72", "#d11a72")).toBeCloseTo(1);
  });

  it("es simétrica: el orden de los colores no importa", () => {
    expect(contraste("#d11a72", "#ffffff")).toBeCloseTo(contraste("#ffffff", "#d11a72"));
  });

  it("acepta el hex corto y el hex sin almohadilla", () => {
    expect(contraste("#fff", "000")).toBeCloseTo(21, 1);
  });

  it("se queja si no le dan un color", () => {
    expect(() => luminancia("rosita")).toThrow();
  });
});

describe("paleta de la marca · texto sobre fondo claro", () => {
  const casos: [string, () => string][] = [
    ["fucsia-texto", PETALO],
    ["fucsia-texto", ROSA_NUBE],
    ["lila-texto", PETALO],
    ["lila-texto", ROSA_NUBE],
    ["carbon", ROSA_NUBE],
    ["carbon-suave", PETALO],
    ["carbon-suave", ROSA_NUBE],
  ];

  for (const [nombreTexto, fondo] of casos) {
    it(`${nombreTexto} sobre ${fondo() === "#ffffff" ? "blanco" : "rosa-nube"} cumple AA`, () => {
      const razon = contraste(token(nombreTexto), fondo());
      expect(
        razon,
        `--color-${nombreTexto} da ${razon.toFixed(2)}:1, hace falta ${AA_NORMAL}:1`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});

describe("paleta de la marca · texto blanco sobre color", () => {
  /**
   * Los fondos de los botones e insignias. Éste es el caso que estaba
   * roto y el más caro: "Agregar" y "Confirmar" son los dos botones de
   * los que vive la tienda.
   */
  for (const fondo of ["fucsia", "lila", "exito", "alerta"]) {
    it(`el texto blanco sobre ${fondo} cumple AA`, () => {
      const razon = contraste(PETALO(), token(fondo));
      expect(
        razon,
        `blanco sobre --color-${fondo} da ${razon.toFixed(2)}:1, hace falta ${AA_NORMAL}:1`
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});

describe("paleta de la marca · avisos", () => {
  it("el aviso de alerta se lee sobre su propio fondo", () => {
    expect(cumpleAA(token("alerta"), token("alerta-fondo"))).toBe(true);
  });

  it("el aviso de éxito se lee sobre su propio fondo", () => {
    expect(cumpleAA(token("exito"), token("exito-fondo"))).toBe(true);
  });
});

describe("paleta de la marca · regresión concreta", () => {
  it("no vuelve a los valores que fallaban", () => {
    // Los originales, para dejar constancia de por qué cambiaron.
    expect(contraste("#e5308a", "#ffffff")).toBeLessThan(AA_NORMAL);
    expect(contraste("#a97fd0", "#ffffff")).toBeLessThan(AA_NORMAL);

    expect(token("fucsia-texto").toLowerCase()).not.toBe("#e5308a");
    expect(token("lila-texto").toLowerCase()).not.toBe("#a97fd0");
    expect(token("fucsia").toLowerCase()).not.toBe("#e5308a");
  });
});
