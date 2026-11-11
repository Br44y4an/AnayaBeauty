import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `server-only` revienta fuera de un Server Component; en pruebas se neutraliza.
vi.mock("server-only", () => ({}));

const { enviar, clienteAdmin, consultaProductos } = vi.hoisted(() => ({
  enviar: vi.fn(),
  clienteAdmin: vi.fn(),
  consultaProductos: vi.fn(),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviar };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ clienteAdmin }));

import { GET } from "@/app/api/diagnostico/route";

const CLAVE = "clave-de-prueba-123";
const RESEND = "re_prueba_abcdefghijklmnopqrstuvwxyz";
const SERVICIO = "sb_secret_abcdefghijklmnopqrstuvwxyz";
const red = vi.fn();

function pedir(ruta = "/api/diagnostico", clave?: string) {
  const headers = clave === undefined ? undefined : { "x-clave-diagnostico": clave };
  return GET(new Request(`http://localhost${ruta}`, { headers }));
}

beforeEach(() => {
  vi.stubEnv("CLAVE_DIAGNOSTICO", CLAVE);
  vi.stubEnv("RESEND_API_KEY", RESEND);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICIO);
  vi.stubEnv("CORREO_DESTINO", "tienda@ejemplo.com");
  vi.stubGlobal("fetch", red);
  red.mockReset();
  enviar.mockReset();
  enviar.mockResolvedValue({ data: { id: "correo-1" }, error: null });
  consultaProductos.mockReset();
  consultaProductos.mockResolvedValue({ count: 372, error: null });
  clienteAdmin.mockReset();
  clienteAdmin.mockReturnValue({ from: () => ({ select: () => ({ eq: consultaProductos }) }) });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/diagnostico sin la clave", () => {
  it("responde 404 sin revelar nada ni revisar la base o el correo", async () => {
    const respuesta = await pedir();

    expect(respuesta.status).toBe(404);
    expect(await respuesta.text()).toBe("");
    expect(clienteAdmin).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
    expect(red).not.toHaveBeenCalled();
  });

  it("con una clave errada responde 404", async () => {
    expect((await pedir("/api/diagnostico", "clave-de-prueba-124")).status).toBe(404);
    expect((await pedir("/api/diagnostico", `${CLAVE}x`)).status).toBe(404);
    expect((await pedir("/api/diagnostico?correo=1", "")).status).toBe(404);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("si el servidor no tiene clave configurada responde 404 a todo", async () => {
    vi.stubEnv("CLAVE_DIAGNOSTICO", "");

    expect((await pedir("/api/diagnostico", "")).status).toBe(404);
    expect((await pedir("/api/diagnostico", "cualquiera")).status).toBe(404);
  });

  it("la respuesta no se guarda en caché", async () => {
    expect((await pedir()).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/diagnostico con la clave", () => {
  it("revisa variables y base sin llamar a Resend", async () => {
    const respuesta = await pedir("/api/diagnostico", CLAVE);
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    expect(cuerpo.baseDeDatos).toEqual({ ok: true, productosActivos: 372 });
    expect(cuerpo.variables.CORREO_DESTINO).toBe("tienda@ejemplo.com");
    expect(cuerpo.correoDePrueba).toMatch(/\?correo=1/);
    expect(enviar).not.toHaveBeenCalled();
    expect(red).not.toHaveBeenCalled();
  });

  it("muestra solo la huella de los secretos, nunca el valor", async () => {
    const texto = await (await pedir("/api/diagnostico", CLAVE)).text();

    expect(texto).not.toContain(RESEND);
    expect(texto).not.toContain(SERVICIO);
    expect(texto).not.toContain(CLAVE);
    expect(texto).toContain("wxyz");
  });

  it("con ?correo=1 envía un solo correo, con la plantilla real, y dice qué pasó", async () => {
    const cuerpo = await (await pedir("/api/diagnostico?correo=1", CLAVE)).json();

    expect(red).not.toHaveBeenCalled();
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toMatchObject({ to: "tienda@ejemplo.com" });
    expect(cuerpo.correoDePrueba).toMatchObject({ ok: true, id: "correo-1" });
  });

  it("si Resend rechaza el correo lo informa en vez de decir que salió", async () => {
    enviar.mockResolvedValue({ data: null, error: { name: "validation_error", message: "dominio no verificado" } });

    const cuerpo = await (await pedir("/api/diagnostico?correo=1", CLAVE)).json();

    expect(cuerpo.correoDePrueba).toEqual({ ok: false, motivo: "validation_error: dominio no verificado" });
  });

  it("si la base falla lo informa y la ruta sigue respondiendo", async () => {
    consultaProductos.mockResolvedValue({ count: null, error: { message: "sin conexión" } });

    const respuesta = await pedir("/api/diagnostico", CLAVE);

    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).baseDeDatos).toEqual({ ok: false, error: "sin conexión" });
  });
});
