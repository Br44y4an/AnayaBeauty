import { describe, it, expect, afterEach, vi } from "vitest";
import { urlSitio } from "@/lib/sitio";

describe("urlSitio", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa NEXT_PUBLIC_SITE_URL sin la barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://anaya-beauty-tau.vercel.app/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "otro.vercel.app");

    expect(urlSitio()).toBe("https://anaya-beauty-tau.vercel.app");
  });

  it("sin NEXT_PUBLIC_SITE_URL usa el dominio de producción de Vercel con https", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "anaya-beauty-tau.vercel.app");

    expect(urlSitio()).toBe("https://anaya-beauty-tau.vercel.app");
  });

  it("en el navegador usa la copia pública que Vercel expone del dominio de producción", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "anaya-beauty-tau.vercel.app");

    expect(urlSitio()).toBe("https://anaya-beauty-tau.vercel.app");
  });

  it("sin ninguna usa el servidor local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(urlSitio()).toBe("http://localhost:3000");
  });

  it("un valor que no es una dirección no se usa", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "anaya-beauty-tau.vercel.app");

    expect(urlSitio()).toBe("https://anaya-beauty-tau.vercel.app");
  });

  it("conserva una ruta base y quita las barras sobrantes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.example.com/catalogo//");

    expect(urlSitio()).toBe("https://tienda.example.com/catalogo");
  });
});
