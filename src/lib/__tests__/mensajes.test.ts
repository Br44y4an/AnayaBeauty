import { describe, it, expect } from "vitest";
import { mensajeAmable } from "@/lib/carrito/mensajes";

const generico = mensajeAmable("ALGO_QUE_NO_EXISTE");

describe("mensajeAmable", () => {
  it("nombra el producto sin stock y señala la bolsa", () => {
    const r = mensajeAmable("SIN_STOCK", "Labial X");

    expect(r.mensaje).toContain("Labial X");
    expect(r.campo).toBe("bolsa");
  });

  it("entiende el error crudo de la base, con nombre y unidades", () => {
    const r = mensajeAmable("SIN_STOCK|Cosmetiquera|2");

    expect(r.mensaje).toContain("Cosmetiquera");
    expect(r.mensaje).toContain("2");
    expect(r.campo).toBe("bolsa");
  });

  it("da un texto propio a cada código nuevo", () => {
    const codigos = ["DEMASIADOS_PEDIDOS", "TONO_NO_DISPONIBLE", "PEDIDO_MUY_GRANDE"];
    const textos = codigos.map((c) => mensajeAmable(c).mensaje);

    for (const texto of textos) expect(texto).not.toBe(generico.mensaje);
    expect(new Set(textos).size).toBe(codigos.length);
  });

  it("marca la bolsa cuando lo que falla es una variante", () => {
    const r = mensajeAmable("TONO_NO_DISPONIBLE", "Brillo labial");

    expect(r.mensaje).toContain("Brillo labial");
    expect(r.campo).toBe("bolsa");
  });

  it("manda los pedidos enormes a WhatsApp", () => {
    expect(mensajeAmable("PEDIDO_MUY_GRANDE").mensaje).toMatch(/WhatsApp/);
  });

  it("nombra el producto retirado del catálogo", () => {
    const r = mensajeAmable("PRODUCTO_NO_DISPONIBLE|Brocha kabuki");

    expect(r.mensaje).toContain("Brocha kabuki");
    expect(r.campo).toBe("bolsa");
  });

  it("un código desconocido da un mensaje genérico sin campo", () => {
    expect(generico.mensaje).toMatch(/WhatsApp/);
    expect(generico.campo).toBeUndefined();
  });

  it("no usa emoji ni exclamaciones en ningún mensaje", () => {
    const codigos = [
      "SIN_STOCK|Labial|1",
      "SIN_STOCK",
      "PRODUCTO_NO_DISPONIBLE",
      "SIN_PRECIO|Labial",
      "CARRITO_VACIO",
      "DATOS_INCOMPLETOS",
      "DEMASIADOS_PEDIDOS",
      "TONO_NO_DISPONIBLE",
      "PEDIDO_MUY_GRANDE",
      "OTRO",
    ];

    for (const codigo of codigos) {
      const { mensaje } = mensajeAmable(codigo);
      expect(mensaje).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(mensaje).not.toMatch(/[!¡]/);
    }
  });
});
