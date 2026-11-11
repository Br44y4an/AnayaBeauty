// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { comprimirImagen, medidasComprimidas } from "@/lib/imagen-navegador";

describe("medidasComprimidas", () => {
  it("reduce el lado mayor a 1600 px conservando la proporción", () => {
    expect(medidasComprimidas(4000, 3000, 1600)).toEqual({ ancho: 1600, alto: 1200 });
    expect(medidasComprimidas(3024, 4032, 1600)).toEqual({ ancho: 1200, alto: 1600 });
  });

  it("nunca agranda una foto pequeña", () => {
    expect(medidasComprimidas(500, 380, 1600)).toEqual({ ancho: 500, alto: 380 });
  });
});

describe("comprimirImagen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function simularLienzo() {
    const contexto = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn(), imageSmoothingQuality: "low" };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      contexto as unknown as CanvasRenderingContext2D
    );
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation(function (this: HTMLCanvasElement, listo: BlobCallback) {
        listo(new Blob([`${this.width}x${this.height}`], { type: "image/jpeg" }));
      });
    return { contexto, toBlob };
  }

  it("dibuja la foto reducida sobre blanco y la exporta en JPEG al 0,85", async () => {
    const mapa = { width: 4000, height: 3000, close: vi.fn() };
    const crear = vi.fn().mockResolvedValue(mapa);
    vi.stubGlobal("createImageBitmap", crear);
    const { contexto, toBlob } = simularLienzo();
    const archivo = new File(["x"], "IMG_0001.HEIC", { type: "image/heic" });

    const blob = await comprimirImagen(archivo);

    expect(crear).toHaveBeenCalledWith(archivo, { imageOrientation: "from-image" });
    expect(contexto.fillStyle).toBe("#ffffff");
    expect(contexto.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
    expect(contexto.drawImage).toHaveBeenCalledWith(mapa, 0, 0, 1600, 1200);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
    expect(await blob.text()).toBe("1600x1200");
    expect(mapa.close).toHaveBeenCalled();
  });

  it("respeta el lado máximo y la calidad que se le pidan", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1000, height: 1000, close: vi.fn() }));
    const { toBlob } = simularLienzo();

    const blob = await comprimirImagen(new File(["x"], "a.png"), 800, 0.7);

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.7);
    expect(await blob.text()).toBe("800x800");
  });

  it("explica el problema si el navegador no puede leer la foto", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("bad")));

    await expect(comprimirImagen(new File(["x"], "rara.tiff"))).rejects.toThrow(
      "No pudimos leer esa foto. Prueba con otra en JPG o PNG."
    );
  });
});
