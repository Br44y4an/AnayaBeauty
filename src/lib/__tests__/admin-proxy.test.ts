import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const prueba = vi.hoisted(() => ({
  usuario: null as { id: string } | null,
  esAdmin: false as boolean | null,
  refrescarCookie: false,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _clave: string,
    { cookies }: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } }
  ) => ({
    auth: {
      getUser: async () => {
        if (prueba.refrescarCookie) cookies.setAll([{ name: "sb-token", value: "nuevo", options: { path: "/" } }]);
        return { data: { user: prueba.usuario } };
      },
    },
    rpc: async () => ({ data: prueba.esAdmin, error: prueba.esAdmin === null ? { message: "x" } : null }),
  }),
}));

import { proxy } from "@/proxy";

const pedir = (ruta: string) => proxy(new NextRequest(new URL(ruta, "http://localhost:3000")));
const destino = (r: Response) => (r.headers.get("location") ? new URL(r.headers.get("location")!).pathname : null);

beforeEach(() => {
  prueba.usuario = null;
  prueba.esAdmin = false;
  prueba.refrescarCookie = false;
});

describe("proxy del panel", () => {
  it("sin sesión, el panel manda al login y el login se muestra", async () => {
    expect(destino(await pedir("/admin/productos"))).toBe("/admin/login");
    expect(destino(await pedir("/admin/login"))).toBeNull();
  });

  it("una cuenta con sesión que no es administradora no entra y puede ver el login", async () => {
    prueba.usuario = { id: "u-nueva" };
    expect(destino(await pedir("/admin"))).toBe("/admin/login");
    expect(destino(await pedir("/admin/login"))).toBeNull();
  });

  it("si no se puede comprobar el rol, no deja pasar", async () => {
    prueba.usuario = { id: "u" };
    prueba.esAdmin = null;
    expect(destino(await pedir("/admin"))).toBe("/admin/login");
  });

  it("una administradora entra; en el login va directo al panel", async () => {
    prueba.usuario = { id: "u-admin" };
    prueba.esAdmin = true;
    expect(destino(await pedir("/admin/recibos"))).toBeNull();
    expect(destino(await pedir("/admin/login"))).toBe("/admin");
  });

  it("al redirigir conserva las cookies de sesión que Supabase acaba de refrescar", async () => {
    prueba.refrescarCookie = true;
    const respuesta = await pedir("/admin");
    expect(destino(respuesta)).toBe("/admin/login");
    expect(respuesta.cookies.get("sb-token")?.value).toBe("nuevo");
  });
});
