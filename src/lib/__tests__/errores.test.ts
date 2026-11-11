import { describe, it, expect, vi, afterEach } from "vitest";
import { falla } from "@/lib/data/errores";

afterEach(() => vi.restoreAllMocks());

describe("falla", () => {
  it("registra el error de la base con su origen y lanza un mensaje legible", () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { code: "42703", message: "column products.orden does not exist" };

    expect(() => falla("catalogo", "No se pudieron cargar los productos", error)).toThrow(
      new Error("No se pudieron cargar los productos.")
    );
    expect(registro).toHaveBeenCalledWith("[catalogo] No se pudieron cargar los productos:", error);
  });
});
