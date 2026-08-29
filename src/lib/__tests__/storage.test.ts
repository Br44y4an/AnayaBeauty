import { describe, it, expect } from "vitest";
import { rutaEnBucket } from "../storage";

const BASE = "https://abc.supabase.co/storage/v1/object/public/productos/";

describe("rutaEnBucket", () => {
  it("saca la ruta de una URL pública del bucket", () => {
    expect(rutaEnBucket(`${BASE}foto.jpg`, "productos")).toBe("foto.jpg");
  });

  it("ignora la query y el fragmento", () => {
    expect(rutaEnBucket(`${BASE}foto.jpg?v=2#a`, "productos")).toBe("foto.jpg");
  });

  it("decodifica los nombres con espacios o acentos", () => {
    expect(rutaEnBucket(`${BASE}labial%20ro%C3%A9.jpg`, "productos")).toBe("labial roé.jpg");
  });

  it("devuelve null para una imagen de otro servidor", () => {
    expect(rutaEnBucket("https://ejemplo.com/foto.jpg", "productos")).toBeNull();
  });

  it("devuelve null para otro bucket", () => {
    expect(
      rutaEnBucket("https://abc.supabase.co/storage/v1/object/public/otros/foto.jpg", "productos")
    ).toBeNull();
  });

  it("devuelve null cuando no hay imagen", () => {
    expect(rutaEnBucket(null, "productos")).toBeNull();
    expect(rutaEnBucket("", "productos")).toBeNull();
  });

  it("devuelve null cuando la ruta viene vacía", () => {
    expect(rutaEnBucket(BASE, "productos")).toBeNull();
  });
});
