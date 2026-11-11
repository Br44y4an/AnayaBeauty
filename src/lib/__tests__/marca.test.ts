import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PALETA } from "@/lib/marca";

/**
 * El correo, el PDF y global-error no pueden leer las variables de CSS, así
 * que usan esta copia. Si alguien cambia un token, esta prueba lo nota.
 */
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function token(nombre: string): string | null {
  const encontrado = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return encontrado ? encontrado[1].toLowerCase() : null;
}

const aKebab = (clave: string) => clave.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

describe("PALETA", () => {
  it.each(Object.entries(PALETA))("%s es igual a su token de globals.css", (clave, valor) => {
    expect(token(aKebab(clave))).toBe(valor.toLowerCase());
  });
});
