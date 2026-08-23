import { describe, it, expect } from "vitest";
import { plantillaCorreoPedido } from "@/lib/email/order-template";

const datos = {
  numeroPedido: "AB-0043",
  nombre: "Laura Gómez",
  whatsapp: "3001234567",
  ciudad: "Medellín",
  codigo: "4821",
  subtotal: 74000,
  descuento: 0,
  porcentaje: 0,
  porMayor: false,
  total: 74000,
  lineas: [
    { referencia: "REF-101", nombre: "Labial Rojo Pasión", tono: "Cereza", cantidad: 3, subtotal: 27000 },
    { referencia: "REF-233", nombre: "Rubor Durazno", tono: null, cantidad: 1, subtotal: 12000 },
    { referencia: "REF-410", nombre: "Base Mate Natural", tono: null, cantidad: 1, subtotal: 35000 },
  ],
};

describe("plantillaCorreoPedido", () => {
  it("incluye los datos que la administradora necesita para despachar", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).toContain("AB-0043");
    expect(html).toContain("Laura Gómez");
    expect(html).toContain("3001234567");
    expect(html).toContain("Medellín");
    expect(html).toContain("4821");
  });

  it("lista cada producto con su referencia y subtotal", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).toContain("REF-101");
    expect(html).toContain("Labial Rojo Pasión");
    expect(html).toContain("$27.000");
    expect(html).toContain("REF-410");
  });

  it("muestra el total formateado en pesos", () => {
    expect(plantillaCorreoPedido(datos)).toContain("$74.000");
  });

  it("escapa el HTML de los datos que escribe la clienta", () => {
    const html = plantillaCorreoPedido({
      ...datos,
      nombre: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("plantillaCorreoPedido — tonos y descuentos", () => {
  it("muestra el tono elegido para que se pueda despachar sin preguntar", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).toContain("Tono: Cereza");
  });

  it("no inventa un tono cuando el producto no tiene", () => {
    const html = plantillaCorreoPedido(datos);
    const apariciones = html.match(/Tono:/g) ?? [];
    expect(apariciones).toHaveLength(1);
  });

  it("desglosa el descuento por porcentaje", () => {
    const html = plantillaCorreoPedido({
      ...datos,
      subtotal: 74000,
      descuento: 3700,
      porcentaje: 5,
      total: 70300,
    });
    expect(html).toContain("Descuento 5%");
    expect(html).toContain("$3.700");
    expect(html).toContain("$70.300");
  });

  it("avisa cuando se aplicó el precio por mayor", () => {
    const html = plantillaCorreoPedido({ ...datos, porMayor: true });
    expect(html).toContain("Precio por mayor aplicado");
  });

  it("omite el desglose cuando no hubo ningún beneficio", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).not.toContain("Precio por mayor aplicado");
    expect(html).not.toContain("Descuento 0%");
  });
});
