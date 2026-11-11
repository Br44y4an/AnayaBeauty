import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { redirect, getUser, rpc } = vi.hoisted(() => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT ${destino}`);
  }),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  crearClienteServidor: async () => ({ auth: { getUser }, rpc }),
}));

import { exigirAdmin } from "@/lib/admin/sesion";

beforeEach(() => {
  redirect.mockClear();
  getUser.mockReset();
  rpc.mockReset();
});

describe("exigirAdmin", () => {
  it("sin sesión manda al login sin preguntar por el rol", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(exigirAdmin()).rejects.toThrow("REDIRECT /admin/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("una cuenta con sesión que no es administradora va al login", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(exigirAdmin()).rejects.toThrow("REDIRECT /admin/login");
    expect(rpc).toHaveBeenCalledWith("es_admin");
  });

  it("si no se puede comprobar el rol, no deja pasar", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });

    await expect(exigirAdmin()).rejects.toThrow("REDIRECT /admin/login");
  });

  it("una administradora pasa y recibe su id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-admin" } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(exigirAdmin()).resolves.toEqual({ userId: "u-admin" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
