import { describe, it, expect } from "vitest";
import { enlaceWhatsApp, normalizarWhatsapp } from "@/lib/whatsapp";

describe("normalizarWhatsapp", () => {
  it("antepone el 57 a un celular colombiano de 10 dígitos", () => {
    expect(normalizarWhatsapp("300 123 4567")).toBe("573001234567");
  });

  it("acepta el indicativo con signos y separadores", () => {
    expect(normalizarWhatsapp("+57 300-123-4567")).toBe("573001234567");
    expect(normalizarWhatsapp("573001234567")).toBe("573001234567");
  });

  it("rechaza lo que no es un número de WhatsApp colombiano", () => {
    expect(normalizarWhatsapp("12345")).toBeNull();
    expect(normalizarWhatsapp("")).toBeNull();
    expect(normalizarWhatsapp("4001234567")).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("abre el chat del número indicado con el mensaje codificado", () => {
    expect(enlaceWhatsApp("Hola mundo", "573001234567")).toBe(
      "https://wa.me/573001234567?text=Hola%20mundo"
    );
  });

  it("sin número usa el WhatsApp de respaldo del negocio", () => {
    expect(enlaceWhatsApp("Hola", null)).toBe("https://wa.me/573228813646?text=Hola");
    expect(enlaceWhatsApp("Hola")).toBe("https://wa.me/573228813646?text=Hola");
  });

  it("normaliza el número y cae al respaldo si no sirve", () => {
    expect(enlaceWhatsApp("Hola", "300 123 4567")).toBe("https://wa.me/573001234567?text=Hola");
    expect(enlaceWhatsApp("Hola", "12")).toBe("https://wa.me/573228813646?text=Hola");
  });

  it("codifica comas, tildes y saltos de línea", () => {
    expect(enlaceWhatsApp("Hola, mi código\nAB-0098", "573001234567")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20mi%20c%C3%B3digo%0AAB-0098"
    );
  });
});
