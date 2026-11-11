import { describe, it, expect } from "vitest";
import { generarReciboPDF } from "@/lib/pdf/recibo";

const DATOS = {
  numero: "AB-0098",
  fecha: new Date("2026-11-11T03:30:00Z"),
  clienteNombre: "María Pérez",
  clienteWhatsapp: "3001234567",
  clienteCiudad: "Medellín",
  lineas: [
    { referencia: "GLS735", nombre: "Brillo labial Oil Glazed", tono: "Tono 2", cantidad: 3, precioUnitario: 7500, subtotal: 22500 },
  ],
  subtotal: 22500,
  descuento: 1125,
  porcentaje: 5,
  porMayor: false,
  total: 21375,
  pagoMetodo: "Nequi",
  pagoNumero: "3228813646",
  pagoTitular: "Anaya Beauty",
};

describe("generarReciboPDF", () => {
  it("se genera aunque el logo no cargue, con textos sobrios y la fecha de Bogotá", async () => {
    // En Node el fetch relativo del logo falla: el encabezado cae al nombre en texto.
    const texto = (await generarReciboPDF(DATOS)).output();

    expect(texto).toContain("Anaya Beauty");
    expect(texto).toContain("Recibo AB-0098");
    expect(texto).toContain("10 de noviembre de 2026");
    expect(texto).toContain("Ref. GLS735");
    expect(texto).toContain("Descuento 5 %");
    expect(texto).toContain("Gracias por comprar en Anaya Beauty.");
    expect(texto).not.toMatch(/princesa|Tono: |¡/);
  });
});
