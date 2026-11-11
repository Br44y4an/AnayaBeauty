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
  it("la ficha y las carpetas que la contienen (salvo (tienda)/) no tienen loading", () => {
    expect(existsSync(path.join(APP, "(tienda)/producto/[referencia]/page.tsx"))).toBe(true);
    expect(esqueletosEn(["", "(tienda)/producto", "(tienda)/producto/[referencia]"])).toEqual([]);
  });

  // Pendiente de la integración: hoy (tienda)/loading.tsx (esqueleto del catálogo) envuelve /producto.
  // Al moverlo con la página a (tienda)/(catalogo)/, esta prueba empieza a fallar: cambia it.fails por it.
  it.fails("tampoco (tienda)/ tiene loading (mover el catálogo a (tienda)/(catalogo)/)", () => {
    expect(esqueletosEn(["(tienda)"])).toEqual([]);
  });
});
