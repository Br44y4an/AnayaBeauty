import { describe, it, expect, vi } from "vitest";

// `server-only` revienta fuera de un Server Component; en pruebas se neutraliza.
vi.mock("server-only", () => ({}));

import { ENVIO_POR_DEFECTO, mapearConfiguracion } from "@/lib/data/configuracion";

const fila = (clave: string, valor: string | null) => ({ clave, valor });

describe("mapearConfiguracion", () => {
  it("sin ajustes guardados usa valores seguros, nunca undefined ni NaN", () => {
    expect(mapearConfiguracion([])).toEqual({
      mensajeExito: null,
      umbralPorMayor: 200000,
      whatsappNegocio: "573228813646",
      envioInfo: "El envío se coordina por WhatsApp después de confirmar tu pedido.",
      pago: { metodo: null, numero: null, titular: null },
    });
    expect(ENVIO_POR_DEFECTO).toBe("El envío se coordina por WhatsApp después de confirmar tu pedido.");
  });

  it("traduce los ajustes guardados", () => {
    const config = mapearConfiguracion([
      fila("mensaje_exito", "Gracias por comprar en Anaya Beauty."),
      fila("umbral_por_mayor", "150000"),
      fila("whatsapp_negocio", "300 123 4567"),
      fila("envio_info", "Envío a todo el país con Interrapidísimo."),
      fila("pago_metodo", "Llave Bre-B"),
      fila("pago_numero", "@RP3001234567"),
      fila("pago_titular", "Ana María"),
    ]);

    expect(config).toEqual({
      mensajeExito: "Gracias por comprar en Anaya Beauty.",
      umbralPorMayor: 150000,
      whatsappNegocio: "573001234567",
      envioInfo: "Envío a todo el país con Interrapidísimo.",
      pago: { metodo: "Llave Bre-B", numero: "@RP3001234567", titular: "Ana María" },
    });
  });

  it("un umbral que no es un número entero cae al valor por defecto", () => {
    for (const valor of ["abc", "-5", "200.000", "", null]) {
      expect(mapearConfiguracion([fila("umbral_por_mayor", valor)]).umbralPorMayor).toBe(200000);
    }
  });

  it("un WhatsApp inválido cae al número de respaldo", () => {
    expect(mapearConfiguracion([fila("whatsapp_negocio", "12")]).whatsappNegocio).toBe(
      "573228813646"
    );
  });

  it("trata los textos en blanco como ausentes", () => {
    const config = mapearConfiguracion([
      fila("mensaje_exito", "   "),
      fila("envio_info", ""),
      fila("pago_numero", "  "),
    ]);

    expect(config.mensajeExito).toBeNull();
    expect(config.envioInfo).toBe(
      "El envío se coordina por WhatsApp después de confirmar tu pedido."
    );
    expect(config.pago.numero).toBeNull();
  });
});
