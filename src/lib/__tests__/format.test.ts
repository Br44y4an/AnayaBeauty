import { describe, it, expect } from "vitest";
import { pesos, enlaceWhatsApp, WHATSAPP_NEGOCIO } from "@/lib/format";

describe("pesos", () => {
  it("formatea con punto de miles y sin decimales", () => {
    expect(pesos(27000)).toBe("$27.000");
    expect(pesos(8000)).toBe("$8.000");
    expect(pesos(1250000)).toBe("$1.250.000");
  });

  it("maneja el cero", () => {
    expect(pesos(0)).toBe("$0");
  });

  it("redondea valores no enteros en vez de mostrar decimales", () => {
    expect(pesos(9999.6)).toBe("$10.000");
  });
});

describe("enlaceWhatsApp", () => {
  it("apunta al número del negocio con el mensaje codificado", () => {
    const url = enlaceWhatsApp("Hola, quiero mi código");
    expect(url).toBe(
      `https://wa.me/${WHATSAPP_NEGOCIO}?text=Hola%2C%20quiero%20mi%20c%C3%B3digo`
    );
  });

  it("usa el número del negocio en formato internacional sin signos", () => {
    expect(WHATSAPP_NEGOCIO).toBe("573132553660");
  });
});
