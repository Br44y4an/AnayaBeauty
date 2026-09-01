import { describe, it, expect } from "vitest";
import { MAX_BYTES, validarImagen, rutaDeImagen } from "@/lib/imagen";

/**
 * Regresión: subir una foto desde el panel lanzaba una excepción en el Server
 * Action y el navegador solo mostraba "Minified React error #441", porque
 * React oculta en producción el mensaje real. Ahora los fallos se devuelven
 * como texto para que el formulario los pueda pintar.
 */
describe("validarImagen", () => {
  it("acepta una foto normal de WhatsApp", () => {
    expect(
      validarImagen({ size: 136387, name: "WhatsApp Image 2026-08-31 at 7.21.50 PM.jpeg" })
    ).toBeNull();
  });

  it("rechaza que no llegue archivo", () => {
    expect(validarImagen(null)).toBe("No seleccionaste ninguna imagen.");
  });

  it("rechaza un archivo vacío", () => {
    expect(validarImagen({ size: 0, name: "foto.jpg" })).toBe(
      "No seleccionaste ninguna imagen."
    );
  });

  it("rechaza una imagen de más de 5 MB explicando cuánto pesa", () => {
    const error = validarImagen({ size: MAX_BYTES + 1, name: "enorme.jpg" });
    expect(error).toContain("5 MB");
    expect(error).toContain("5.0 MB");
  });

  it("acepta justo el límite", () => {
    expect(validarImagen({ size: MAX_BYTES, name: "justa.jpg" })).toBeNull();
  });
});

describe("rutaDeImagen", () => {
  it("conserva la extensión del nombre original", () => {
    expect(rutaDeImagen("WhatsApp Image 2026-08-31 at 7.21.50 PM.jpeg", "abc")).toBe(
      "abc.jpeg"
    );
  });

  it("normaliza la extensión a minúsculas", () => {
    expect(rutaDeImagen("FOTO.JPEG", "abc")).toBe("abc.jpeg");
  });

  it("cae a jpg cuando el nombre no tiene extensión", () => {
    expect(rutaDeImagen("sinextension", "abc")).toBe("abc.jpg");
    expect(rutaDeImagen("", "abc")).toBe("abc.jpg");
  });

  it("no arrastra espacios ni rutas del nombre original", () => {
    // El nombre del archivo nunca entra en la ruta: solo el uuid y la extensión.
    expect(rutaDeImagen("mi foto rara.png", "abc")).toBe("abc.png");
    expect(rutaDeImagen("a/b/c.png", "abc")).toBe("abc.png");
  });

  it("ignora una extensión absurdamente larga o con basura", () => {
    expect(rutaDeImagen("foto.jpeg?token=1", "abc")).toBe("abc.jpg");
    expect(rutaDeImagen("foto.unaextensionquenoexiste", "abc")).toBe("abc.jpg");
  });
});
