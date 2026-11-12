import { describe, it, expect } from "vitest";
import { generarReciboPDF, type DatosRecibo } from "@/lib/pdf/recibo";

const DATOS: DatosRecibo = {
  titulo: "Recibo",
  numero: "AB-0098",
  fecha: new Date("2026-11-11T03:30:00Z"),
  destinatario: { nombre: "María Pérez", documento: "", whatsapp: "3001234567", ciudad: "Medellín", direccion: "" },
  lineas: [
    { referencia: "GLS735", nombre: "Brillo labial Oil Glazed", tono: "Tono 2", cantidad: 3, precioUnitario: 7500, subtotal: 22500 },
  ],
  subtotal: 22500,
  descuento: 1125,
  porcentaje: 5,
  porMayor: false,
  total: 21375,
  nota: "",
  mostrarPago: true,
  pagoMetodo: "Nequi",
  pagoNumero: "3228813646",
  pagoTitular: "Anaya Beauty",
};

async function texto(datos: DatosRecibo): Promise<string> {
  return (await generarReciboPDF(datos)).output();
}

/** Solo lo impreso: la estructura del PDF trae su propio «null» (/OpenAction). */
function impreso(pdf: string): string {
  return [...pdf.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join("\n");
}

describe("generarReciboPDF", () => {
  it("se genera aunque el logo no cargue, con textos sobrios y la fecha de Bogotá", async () => {
    // En Node el fetch relativo del logo falla: el encabezado cae al nombre en texto.
    const pdf = await texto(DATOS);

    expect(pdf).toContain("Anaya Beauty");
    expect(pdf).toContain("Recibo AB-0098");
    expect(pdf).toContain("10 de noviembre de 2026");
    expect(pdf).toContain("DIRIGIDO A");
    expect(pdf).toContain("Medellín · 3001234567");
    expect(pdf).toContain("Ref. GLS735");
    expect(pdf).toContain("Descuento 5 %");
    expect(pdf).toContain("Para completar tu pago");
    expect(pdf).toContain("Gracias por comprar en Anaya Beauty.");
    expect(pdf).not.toMatch(/princesa|Tono: |¡/);
  });

  it("usa el título personalizado y solo los datos presentes del destinatario, sin «null»", async () => {
    const pdf = await texto({
      ...DATOS,
      titulo: "Cuenta de cobro",
      destinatario: {
        nombre: "Distribuidora Luna SAS",
        documento: "NIT 900.123.456-7",
        whatsapp: "",
        ciudad: "",
        direccion: "Cra 43A # 1-50",
      },
    });

    expect(pdf).toContain("Cuenta de cobro AB-0098");
    expect(pdf).not.toContain("Recibo AB-0098");
    expect(pdf).toContain("Distribuidora Luna SAS");
    expect(pdf).toContain("Documento: NIT 900.123.456-7");
    expect(pdf).toContain("Cra 43A # 1-50");
    expect(impreso(pdf)).toContain("Distribuidora Luna SAS");
    expect(impreso(pdf)).not.toMatch(/null|undefined|NaN|·\s*$/m);
  });

  it("las líneas en texto salen sin referencia y la nota reemplaza el cierre, con sus saltos de línea", async () => {
    const pdf = await texto({
      ...DATOS,
      lineas: [{ referencia: null, nombre: "Envío a Pereira", cantidad: 1, precioUnitario: 12000, subtotal: 12000 }],
      subtotal: 12000,
      descuento: 0,
      porcentaje: 0,
      total: 12000,
      nota: "Gracias por tu compra.\nCambios dentro de los 5 días siguientes con este recibo.",
    });

    expect(pdf).toContain("Envío a Pereira");
    expect(pdf).not.toContain("Ref.");
    expect(pdf).toContain("Gracias por tu compra.");
    expect(pdf).toContain("Cambios dentro de los 5 días siguientes con este recibo.");
    expect(pdf).not.toContain("Gracias por comprar en Anaya Beauty.");
  });

  it("sin la casilla de pago no imprime los datos de pago", async () => {
    const pdf = await texto({ ...DATOS, mostrarPago: false });

    expect(pdf).not.toContain("Para completar tu pago");
    expect(pdf).not.toContain("3228813646");
  });

  it("quita emoji y comillas curvas en vez de dañar el renglón", async () => {
    const pdf = await texto({
      ...DATOS,
      titulo: "Cotización",
      destinatario: { ...DATOS.destinatario, nombre: "Ana “la de Pereira” 💖" },
    });

    expect(pdf).toContain("Cotización AB-0098");
    expect(pdf).toContain('Ana "la de Pereira"');
  });

  it("con muchas líneas abre páginas nuevas y repite el encabezado de la tabla", async () => {
    const lineas = Array.from({ length: 45 }, (_, i) => ({
      referencia: i % 3 === 0 ? null : `REF${i}`,
      nombre:
        i % 5 === 0
          ? `Producto con un nombre muy largo que no cabe en una sola fila de la tabla del recibo número ${i}`
          : `Producto ${i}`,
      tono: i % 4 === 0 ? `Tono ${i}` : null,
      cantidad: 1,
      precioUnitario: 1000,
      subtotal: 1000,
    }));
    const doc = await generarReciboPDF({
      ...DATOS,
      lineas,
      subtotal: 45000,
      descuento: 0,
      porcentaje: 0,
      total: 45000,
      nota: "Línea de nota.\n".repeat(20),
    });
    const pdf = doc.output();
    const paginas = doc.getNumberOfPages();

    expect(paginas).toBeGreaterThanOrEqual(2);
    expect(pdf.split("(PRODUCTO)").length - 1).toBeGreaterThanOrEqual(2);
    expect(pdf).toContain(`(${paginas}/${paginas})`);
    expect(pdf).toContain("Producto 44");
  });
});
