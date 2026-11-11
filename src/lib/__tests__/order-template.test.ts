import { describe, it, expect } from "vitest";
import { plantillaCorreoPedido } from "@/lib/email/order-template";
import { PALETA } from "@/lib/marca";

const datos = {
  numeroPedido: "AB-0043",
  nombre: "Laura Gómez",
  whatsapp: "3001234567",
  ciudad: "Medellín",
  notas: null,
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
    // Ya no hay códigos: en su lugar viaja la nota de la clienta, que es
    // lo que de verdad necesita quien despacha.
    expect(html).not.toContain("Código usado");
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
    expect(html).toContain("Descuento 5 %");
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
    expect(html).not.toContain("Descuento 0 %");
  });
});

describe("plantillaCorreoPedido — sistema visual v5", () => {
  it("no lleva emoji ni el «Código usado» de la v3", () => {
    const html = plantillaCorreoPedido({
      ...datos,
      porMayor: true,
      porcentaje: 5,
      descuento: 3700,
      notas: "Es un regalo",
    });
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).not.toContain("Código usado");
  });

  it("usa solo los colores de la paleta de la marca", () => {
    const html = plantillaCorreoPedido(datos);
    const permitidos = new Set(Object.values(PALETA).map((c) => c.toLowerCase()));
    const usados = (html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toLowerCase());

    expect(usados.length).toBeGreaterThan(0);
    expect(usados.filter((c) => !permitidos.has(c))).toEqual([]);
  });

  it("rotula el total como «Total productos»: el envío se coordina aparte", () => {
    expect(plantillaCorreoPedido(datos)).toContain("Total productos");
  });

  it("el botón del panel apunta al sitio desde el que se hizo el pedido", () => {
    const html = plantillaCorreoPedido({ ...datos, sitio: "https://tienda.test" });
    expect(html).toContain('href="https://tienda.test/admin?q=AB-0043"');
  });
});
