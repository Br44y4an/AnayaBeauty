import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// notFound() solo responde 404 si ocurre fuera de todo <Suspense>. Un loading.tsx en cualquier carpeta
// entre src/app y la ficha manda la página antes y el producto inexistente sale con 200 + noindex.
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const NOMBRES = ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"];

function esqueletosEn(carpetas: string[]): string[] {
  return carpetas.flatMap((c) => NOMBRES.map((n) => path.join(c, n))).filter((r) => existsSync(path.join(APP, r)));
}

describe("ficha de producto: 404 real para un producto inexistente", () => {
  it("ni la ficha ni las carpetas que la contienen tienen loading", () => {
    expect(existsSync(path.join(APP, "(tienda)/producto/[referencia]/page.tsx"))).toBe(true);
    expect(esqueletosEn(["", "(tienda)", "(tienda)/producto", "(tienda)/producto/[referencia]"])).toEqual([]);
  });

  it("el esqueleto del catálogo vive con su página en (tienda)/(catalogo)/, que sigue siendo «/»", () => {
    expect(existsSync(path.join(APP, "(tienda)/(catalogo)/page.tsx"))).toBe(true);
    expect(esqueletosEn(["(tienda)/(catalogo)"])).toEqual([path.join("(tienda)/(catalogo)", "loading.tsx")]);
    expect(existsSync(path.join(APP, "(tienda)/page.tsx"))).toBe(false);
  });
});
