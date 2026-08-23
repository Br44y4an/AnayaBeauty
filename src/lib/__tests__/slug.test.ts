import { describe, it, expect } from "vitest";
import { generarSlug } from "@/lib/slug";

describe("generarSlug", () => {
  it("pasa a minúsculas y une con guiones", () => {
    expect(generarSlug("Labiales Mate")).toBe("labiales-mate");
  });

  it("quita las tildes y la eñe", () => {
    expect(generarSlug("Máscara de Pestañas")).toBe("mascara-de-pestanas");
  });

  it("descarta símbolos y emojis", () => {
    expect(generarSlug("Rubor Durazno ♡ ✨")).toBe("rubor-durazno");
  });

  it("no deja guiones sueltos en los extremos", () => {
    expect(generarSlug("  Ojos  ")).toBe("ojos");
    expect(generarSlug("¡Nuevo!")).toBe("nuevo");
  });

  it("colapsa separadores repetidos", () => {
    expect(generarSlug("Base   —   Mate")).toBe("base-mate");
  });
});
