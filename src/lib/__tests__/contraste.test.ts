import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contraste, luminancia, AA_NORMAL } from "@/lib/color";

// Lee los tokens reales de globals.css: si alguien aviva un color, la prueba dice cuánto contraste perdió.
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function token(nombre: string): string {
  const encontrado = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!encontrado) throw new Error(`No existe el token --color-${nombre} en globals.css`);
  return encontrado[1];
}

function exigir(texto: string, fondo: string, minimo: number) {
  const razon = contraste(token(texto), token(fondo));
  expect(
    razon,
    `--color-${texto} sobre --color-${fondo} da ${razon.toFixed(2)}:1, hace falta ${minimo}:1`
  ).toBeGreaterThanOrEqual(minimo);
}

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

describe("paleta v5 · texto (AA, 4,5:1)", () => {
  const casos: [texto: string, fondo: string][] = [
    ["tinta", "fondo"],
    ["tinta-suave", "fondo"],
    ["tinta-suave", "superficie"],
    ["tinta-suave", "inactivo"],
    ["firma", "fondo"],
    ["firma", "superficie"],
    ["acento", "fondo"],
    ["ahorro", "fondo"],
    ["ahorro", "ahorro-fondo"],
    ["alerta", "alerta-fondo"],
    ["error", "error-fondo"],
  ];

  for (const [texto, fondo] of casos) {
    it(`${texto} sobre ${fondo}`, () => exigir(texto, fondo, AA_NORMAL));
  }

  it("el fondo es blanco: es el color del texto de los botones primarios", () => {
    expect(token("fondo").toLowerCase()).toBe("#ffffff");
  });

  for (const relleno of ["acento", "acento-hondo"]) {
    it(`blanco sobre ${relleno} (botón primario, normal y presionado)`, () =>
      exigir("fondo", relleno, AA_NORMAL));
  }
});

describe("paleta v5 · bordes de controles (WCAG 1.4.11, 3:1)", () => {
  for (const fondo of ["fondo", "superficie"]) {
    it(`borde sobre ${fondo}`, () => exigir("borde", fondo, 3));
  }
});

describe("paleta v5 · regresión", () => {
  it("ningún token vuelve a los colores de la marca que no se leían", () => {
    // #e5308a con blanco da 4,10:1 y #a97fd0 da 3,17:1: no sirven para texto ni para botones.
    expect(contraste("#e5308a", "#ffffff")).toBeLessThan(AA_NORMAL);
    expect(contraste("#a97fd0", "#ffffff")).toBeLessThan(AA_NORMAL);

    const valores = [...css.matchAll(/--color-[a-z-]+:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) =>
      m[1].toLowerCase()
    );
    expect(valores.length).toBeGreaterThan(10);
    expect(valores).not.toContain("#e5308a");
    expect(valores).not.toContain("#a97fd0");
  });
});
