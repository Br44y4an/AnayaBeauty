import { describe, it, expect } from "vitest";
import { plantillaCorreoPedido } from "@/lib/email/order-template";

const datos = {
  numeroPedido: "AB-0043",
  nombre: "Laura Gómez",
  whatsapp: "3001234567",
  ciudad: "Medellín",
  codigo: "4821",
  total: 74000,
  lineas: [
    { referencia: "REF-101", nombre: "Labial Rojo Pasión", cantidad: 3, subtotal: 27000 },
    { referencia: "REF-233", nombre: "Rubor Durazno", cantidad: 1, subtotal: 12000 },
    { referencia: "REF-410", nombre: "Base Mate Natural", cantidad: 1, subtotal: 35000 },
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
