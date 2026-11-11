import { describe, it, expect, vi, beforeEach } from "vitest";
import { clienteFalso, type ConsultaFalsa, type RespuestaFalsa } from "@/lib/__tests__/supabase-falso";

const prueba = vi.hoisted(() => ({ cliente: null as unknown, invalidar: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), unstable_cache: (f: unknown) => f }));
vi.mock("@/lib/supabase/publico", () => ({ clientePublico: () => ({}) }));
vi.mock("@/lib/admin/sesion", () => ({ exigirAdmin: async () => ({ userId: "u" }) }));
vi.mock("@/lib/data/invalidar", () => ({ invalidarCatalogo: prueba.invalidar }));
vi.mock("@/lib/supabase/server", () => ({ crearClienteServidor: async () => prueba.cliente }));
vi.mock("@/lib/admin/producto", () => ({
  leerFormularioProducto: () => ({
    ok: true,
    producto: {
      id: "8a1f2c3d-0000-4000-8000-000000000001",
      referencia: "REF-1",
      nombre: "Labial",
      descripcion: null,
      stock: 5,
      categoriaId: null,
      etiquetaVariante: null,
      activo: true,
      destacado: false,
      imagenPrincipal: null,
      escalones: [{ minCantidad: 1, precioUnitario: 10000 }],
      variantes: [],
    },
  }),
}));

import { guardarProducto } from "../actions";

function usar(responder: (c: ConsultaFalsa) => RespuestaFalsa) {
  prueba.cliente = clienteFalso(responder).cliente;
}

const ok = { data: [], error: null };

beforeEach(() => {
  prueba.invalidar.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("guardarProducto", () => {
  const datos = () => {
    const f = new FormData();
    f.set("id", "8a1f2c3d-0000-4000-8000-000000000001");
    return f;
  };

  it("si fallan los precios tras actualizar el producto, devuelve el error e invalida la caché", async () => {
    usar((c) => {
      if (c.origen === "from:price_tiers") return { data: null, error: { message: "boom" } };
      if (c.llamadas.some(([m]) => m === "maybeSingle")) {
        return { data: { imagen_principal: null, product_shades: [] }, error: null };
      }
      return ok;
    });

    const r = await guardarProducto(datos());
    expect(r).toMatchObject({ ok: false });
    expect(prueba.invalidar).toHaveBeenCalledTimes(1);
  });

  it("si todo sale bien invalida una sola vez", async () => {
    usar((c) =>
      c.llamadas.some(([m]) => m === "maybeSingle")
        ? { data: { imagen_principal: null, product_shades: [] }, error: null }
        : ok
    );
    await expect(guardarProducto(datos())).resolves.toMatchObject({ ok: true });
    expect(prueba.invalidar).toHaveBeenCalledTimes(1);
  });
});
