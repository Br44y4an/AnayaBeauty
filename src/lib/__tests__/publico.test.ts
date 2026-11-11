import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
const supabase = vi.hoisted(() => ({ createClient: vi.fn(() => ({ cliente: "anonimo" })) }));
vi.mock("@supabase/supabase-js", () => supabase);

/** El cliente vive en el módulo: cada prueba lo importa de cero. */
async function importar() {
  vi.resetModules();
  return (await import("@/lib/supabase/publico")).clientePublico;
}

beforeEach(() => {
  supabase.createClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave-anonima");
});

afterEach(() => vi.unstubAllEnvs());

describe("clientePublico", () => {
  it("crea un solo cliente anónimo, sin sesión ni cookies", async () => {
    const clientePublico = await importar();

    expect(clientePublico()).toBe(clientePublico());
    expect(supabase.createClient).toHaveBeenCalledTimes(1);
    expect(supabase.createClient).toHaveBeenCalledWith("https://proyecto.supabase.co", "clave-anonima", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "sin %s lanza un error que la nombra",
    async (variable) => {
      vi.stubEnv(variable, "");
      const clientePublico = await importar();

      expect(() => clientePublico()).toThrow(variable);
      expect(supabase.createClient).not.toHaveBeenCalled();
    }
  );

  it("sin ninguna de las dos las nombra a ambas", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    const clientePublico = await importar();

    expect(() => clientePublico()).toThrow(/NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
