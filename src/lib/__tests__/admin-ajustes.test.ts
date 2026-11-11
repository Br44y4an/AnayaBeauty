import { describe, it, expect } from "vitest";
import { CLAVES_AJUSTES, celularLegible, validarAjuste, validarReglaDescuento } from "@/lib/admin/ajustes";

describe("CLAVES_AJUSTES", () => {
  it("son las siete claves que lee la tienda, sin la del código de acceso", () => {
    expect(CLAVES_AJUSTES).toEqual([
      "mensaje_exito",
      "umbral_por_mayor",
      "pago_metodo",
      "pago_numero",
      "pago_titular",
      "whatsapp_negocio",
      "envio_info",
    ]);
    expect(CLAVES_AJUSTES).not.toContain("horas_vigencia_codigo");
  });
});

describe("validarAjuste", () => {
  it("normaliza el WhatsApp con espacios o +57 a 57 y 10 dígitos", () => {
    expect(validarAjuste("whatsapp_negocio", "300 123 4567")).toEqual({ ok: true, valor: "573001234567" });
    expect(validarAjuste("whatsapp_negocio", "+57 300-123-4567")).toEqual({ ok: true, valor: "573001234567" });
  });

  it("rechaza un WhatsApp incompleto o vacío", () => {
    const corto = validarAjuste("whatsapp_negocio", "12");
    expect(corto.ok).toBe(false);
    if (!corto.ok) expect(corto.error).toBe("Escribe un celular de Colombia de 10 dígitos, por ejemplo 300 123 4567.");
    expect(validarAjuste("whatsapp_negocio", "  ").ok).toBe(false);
  });

  it("rechaza una clave desconocida", () => {
    expect(validarAjuste("horas_vigencia_codigo", "24")).toEqual({ ok: false, error: "Ese ajuste no existe." });
    expect(validarAjuste("$ACTION_ID_abc", "")).toEqual({ ok: false, error: "Ese ajuste no existe." });
  });

  it("guarda el umbral por mayor como número entero sin puntos", () => {
    expect(validarAjuste("umbral_por_mayor", "200.000")).toEqual({ ok: true, valor: "200000" });
    expect(validarAjuste("umbral_por_mayor", "$ 150.000")).toEqual({ ok: true, valor: "150000" });
    expect(validarAjuste("umbral_por_mayor", "80000")).toEqual({ ok: true, valor: "80000" });
  });

  it("rechaza un umbral negativo, cero, vacío o con letras", () => {
    for (const valor of ["-5", "0", "", "doscientos mil", "1,5"]) {
      expect(validarAjuste("umbral_por_mayor", valor).ok, valor).toBe(false);
    }
  });

  it("rechaza un umbral absurdo que no cabe en la base", () => {
    expect(validarAjuste("umbral_por_mayor", "99999999999").ok).toBe(false);
  });

  it("acepta textos libres sin espacios sobrantes y permite dejarlos vacíos", () => {
    expect(validarAjuste("envio_info", "  Envío gratis en Bogotá.  ")).toEqual({ ok: true, valor: "Envío gratis en Bogotá." });
    expect(validarAjuste("mensaje_exito", "")).toEqual({ ok: true, valor: "" });
    expect(validarAjuste("pago_metodo", "Nequi")).toEqual({ ok: true, valor: "Nequi" });
  });

  it("rechaza textos demasiado largos", () => {
    expect(validarAjuste("pago_titular", "x".repeat(81)).ok).toBe(false);
    expect(validarAjuste("envio_info", "x".repeat(301)).ok).toBe(false);
  });
});

describe("validarReglaDescuento", () => {
  it("lee el monto como lo escribe una persona y el porcentaje con o sin signo", () => {
    expect(validarReglaDescuento("50.000", "5")).toEqual({ ok: true, montoMinimo: 50000, porcentaje: 5 });
    expect(validarReglaDescuento("$ 120.000", "10 %")).toEqual({ ok: true, montoMinimo: 120000, porcentaje: 10 });
  });

  it("marca cada campo con su error", () => {
    expect(validarReglaDescuento("", "0")).toEqual({
      ok: false,
      error: "Revisa los campos marcados.",
      campos: {
        monto_minimo: "Escribe un monto en pesos mayor que 0, por ejemplo 50.000.",
        porcentaje: "Escribe un porcentaje entero entre 1 y 100.",
      },
    });
    expect(validarReglaDescuento("50000", "5,5").ok).toBe(false);
    expect(validarReglaDescuento("50000", "101").ok).toBe(false);
    expect(validarReglaDescuento("-50000", "5").ok).toBe(false);
  });
});

describe("celularLegible", () => {
  it("muestra el número guardado como lo escribiría la dueña", () => {
    expect(celularLegible("573001234567")).toBe("300 123 4567");
    expect(celularLegible("")).toBe("");
    expect(celularLegible("12345")).toBe("12345");
  });
});
