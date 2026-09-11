import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `server-only` revienta fuera de un Server Component; en pruebas se neutraliza.
vi.mock("server-only", () => ({}));

const enviar = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: enviar };
  },
}));

const datos = {
  numeroPedido: "AB-0043",
  nombre: "Laura Gómez",
  whatsapp: "3001234567",
  ciudad: "Medellín",
  notas: null,
  subtotal: 74000,
  descuento: 0,
  porcentaje: 0,
  porMayor: false,
  total: 74000,
  lineas: [
    { referencia: "REF-101", nombre: "Labial Rojo Pasión", tono: "Cereza", cantidad: 3, subtotal: 27000 },
  ],
};

async function cargar() {
  vi.resetModules();
  return (await import("@/lib/email/send-order")).enviarCorreoPedido;
}

describe("enviarCorreoPedido", () => {
  beforeEach(() => {
    enviar.mockReset();
    process.env.RESEND_API_KEY = "re_prueba";
    process.env.CORREO_DESTINO = "anayabeauty54@gmail.com";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("informa que sí se envió cuando Resend acepta", async () => {
    enviar.mockResolvedValue({ data: { id: "abc-123" }, error: null });
    const enviarCorreoPedido = await cargar();

    const resultado = await enviarCorreoPedido(datos);

    if (!resultado.ok) throw new Error(`esperaba éxito, falló: ${resultado.motivo}`);
    expect(resultado.id).toBe("abc-123");
  });

  // Este es el fallo que dejaba a la administradora sin avisos y sin señal:
  // el SDK de Resend NO lanza cuando la API rechaza, devuelve { data, error }.
  // El try/catch de antes solo atrapaba fallos de red, así que un 403 por
  // enviar a una dirección no verificada se perdía en silencio.
  it("informa el fallo cuando Resend rechaza (no lanza, devuelve error)", async () => {
    enviar.mockResolvedValue({
      data: null,
      error: {
        statusCode: 403,
        name: "validation_error",
        message: "You can only send testing emails to your own email address",
      },
    });
    const enviarCorreoPedido = await cargar();

    const resultado = await enviarCorreoPedido(datos);

    if (resultado.ok) throw new Error("esperaba fallo, pero informó éxito");
    expect(resultado.motivo).toContain("only send testing emails");
    expect(console.error).toHaveBeenCalled();
  });

  it("informa el fallo cuando la red se cae, sin lanzar", async () => {
    enviar.mockRejectedValue(new Error("fetch failed"));
    const enviarCorreoPedido = await cargar();

    const resultado = await enviarCorreoPedido(datos);

    if (resultado.ok) throw new Error("esperaba fallo, pero informó éxito");
    expect(resultado.motivo).toContain("fetch failed");
  });

  it("informa el fallo cuando falta configuración", async () => {
    delete process.env.RESEND_API_KEY;
    const enviarCorreoPedido = await cargar();

    const resultado = await enviarCorreoPedido(datos);

    if (resultado.ok) throw new Error("esperaba fallo, pero informó éxito");
    expect(resultado.motivo).toContain("RESEND_API_KEY");
    expect(enviar).not.toHaveBeenCalled();
  });
});
