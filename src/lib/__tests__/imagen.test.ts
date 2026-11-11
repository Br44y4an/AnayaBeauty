import { describe, it, expect } from "vitest";
import { MAX_BYTES, validarImagen, rutaDeImagen, tipoDeImagen } from "@/lib/imagen";

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

/** El servidor no confía en el nombre ni en el tipo que manda el navegador: mira los primeros bytes. */
describe("tipoDeImagen", () => {
  const bytes = (...valores: number[]) => new Uint8Array([...valores, ...new Array(12).fill(0)]);

  it("reconoce JPEG, PNG y WebP por su firma", () => {
    expect(tipoDeImagen(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ extension: "jpg", mime: "image/jpeg" });
    expect(tipoDeImagen(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      extension: "png",
      mime: "image/png",
    });
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(tipoDeImagen(webp)).toEqual({ extension: "webp", mime: "image/webp" });
  });

  it("rechaza lo que no es una foto", () => {
    expect(tipoDeImagen(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(tipoDeImagen(new Uint8Array([]))).toBeNull();
  });
});
