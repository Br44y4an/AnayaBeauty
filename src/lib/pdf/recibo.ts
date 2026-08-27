import { jsPDF } from "jspdf";
import { pesos } from "@/lib/format";

/**
 * Recibo bonito en PDF para el panel de admin.
 *
 * Se genera 100% en el navegador (jsPDF): no hay servidor ni impresora
 * headless de por medio, así que sigue funcionando dentro de la capa
 * gratuita del proyecto.
 */

export type LineaRecibo = {
  referencia: string;
  nombre: string;
  tono?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type DatosRecibo = {
  numero: string;
  fecha: Date;
  clienteNombre: string;
  clienteWhatsapp?: string | null;
  clienteCiudad?: string | null;
  lineas: LineaRecibo[];
  subtotal: number;
  descuento: number;
  porcentaje: number;
  porMayor: boolean;
  total: number;
  pagoMetodo?: string | null;
  pagoNumero?: string | null;
  pagoTitular?: string | null;
};

// Los mismos colores de globals.css, en RGB (jsPDF no entiende hex con setFillColor de un tirón en todas las versiones de forma fiable).
const FUCSIA: [number, number, number] = [229, 48, 138];
const LILA: [number, number, number] = [169, 127, 208];
const LILA_SUAVE: [number, number, number] = [221, 201, 238];
const ROSA_NUBE: [number, number, number] = [253, 242, 247];
const CARBON: [number, number, number] = [61, 43, 54];
const CARBON_SUAVE: [number, number, number] = [122, 100, 112];
const BLANCO: [number, number, number] = [255, 255, 255];

async function cargarLogoBase64(): Promise<string | null> {
  try {
    const respuesta = await fetch("/logo.jpg");
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    return await new Promise((resolver) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result as string);
      lector.onerror = () => resolver(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const MARGEN = 40;
const ALTO_ENCABEZADO = 120;
const ALTO_PIE = 90;

/** Si no cabe lo que sigue, abre una página nueva y avisa con `saltoDePagina`. */
function asegurarEspacio(
  doc: jsPDF,
  y: number,
  necesario: number
): { y: number; saltoDePagina: boolean } {
  const altoPagina = doc.internal.pageSize.getHeight();
  if (y + necesario > altoPagina - ALTO_PIE) {
    doc.addPage();
    return { y: MARGEN + 10, saltoDePagina: true };
  }
  return { y, saltoDePagina: false };
}

export async function generarReciboPDF(datos: DatosRecibo): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const logo = await cargarLogoBase64();

  // ---------- Encabezado ----------
  doc.setFillColor(...ROSA_NUBE);
  doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");

  const xTitulo = MARGEN + (logo ? 74 : 0);
  if (logo) {
    try {
      doc.addImage(logo, "JPEG", MARGEN, 24, 60, 60, undefined, "FAST");
    } catch {
      // Si el logo no carga (fetch bloqueado, red, etc.) el recibo se genera igual.
    }
  }

  doc.setTextColor(...FUCSIA);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(26);
  doc.text("Anaya Beauty", xTitulo, 56);

  doc.setTextColor(...LILA);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Belleza que te define", xTitulo, 74);

  doc.setTextColor(...CARBON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Recibo ${datos.numero}`, ancho - MARGEN, 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CARBON_SUAVE);
  doc.text(
    datos.fecha.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    ancho - MARGEN,
    60,
    { align: "right" }
  );

  let y = ALTO_ENCABEZADO + 30;

  // ---------- Datos del cliente ----------
  doc.setFillColor(...ROSA_NUBE);
  doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, 56, 8, 8, "F");
  doc.setTextColor(...CARBON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(datos.clienteNombre || "Cliente", MARGEN + 16, y + 22);

  const detalleCliente = [datos.clienteCiudad, datos.clienteWhatsapp]
    .filter((v) => v && v.trim())
    .join("  ·  ");
  if (detalleCliente) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CARBON_SUAVE);
    doc.text(detalleCliente, MARGEN + 16, y + 40);
  }

  y += 80;

  // ---------- Tabla de productos ----------
  const xNombre = MARGEN;
  const xCantidad = ancho - MARGEN - 170;
  const xPrecio = ancho - MARGEN - 90;
  const xSubtotal = ancho - MARGEN;

  function encabezadoTabla(yTabla: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...CARBON_SUAVE);
    doc.text("PRODUCTO", xNombre, yTabla);
    doc.text("CANT.", xCantidad, yTabla, { align: "right" });
    doc.text("P. UNIT.", xPrecio, yTabla, { align: "right" });
    doc.text("SUBTOTAL", xSubtotal, yTabla, { align: "right" });
    const yLinea = yTabla + 6;
    doc.setDrawColor(...LILA_SUAVE);
    doc.line(MARGEN, yLinea, ancho - MARGEN, yLinea);
    return yLinea + 18;
  }

  y = encabezadoTabla(y);

  for (const linea of datos.lineas) {
    const espacio = asegurarEspacio(doc, y, 34);
    y = espacio.y;
    if (espacio.saltoDePagina) y = encabezadoTabla(y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...LILA);
    doc.text(linea.referencia, xNombre, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CARBON);
    doc.text(linea.nombre, xNombre, y + 13, { maxWidth: xCantidad - xNombre - 16 });

    if (linea.tono) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...FUCSIA);
      doc.text(`Tono: ${linea.tono}`, xNombre, y + 26);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CARBON);
    doc.text(`x${linea.cantidad}`, xCantidad, y, { align: "right" });
    doc.text(pesos(linea.precioUnitario), xPrecio, y, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...FUCSIA);
    doc.text(pesos(linea.subtotal), xSubtotal, y, { align: "right" });

    y += linea.tono ? 36 : 30;
  }

  y += 6;
  doc.setDrawColor(...LILA_SUAVE);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 22;

  // ---------- Totales ----------
  y = asegurarEspacio(doc, y, 110).y;

  function filaTotal(etiqueta: string, valor: string, destacado = false) {
    doc.setFont("helvetica", destacado ? "bold" : "normal");
    doc.setFontSize(destacado ? 14 : 10);
    doc.setTextColor(...(destacado ? FUCSIA : CARBON_SUAVE));
    doc.text(etiqueta, xPrecio, y, { align: "right" });
    doc.text(valor, xSubtotal, y, { align: "right" });
    y += destacado ? 22 : 16;
  }

  if (datos.porMayor || datos.porcentaje > 0) {
    filaTotal("Subtotal", pesos(datos.subtotal));
    if (datos.porMayor) filaTotal("Precio por mayor", "aplicado");
    if (datos.porcentaje > 0) {
      filaTotal(`Descuento ${datos.porcentaje}%`, `-${pesos(datos.descuento)}`);
    }
  }
  filaTotal("TOTAL", pesos(datos.total), true);

  // ---------- Datos de pago ----------
  if (datos.pagoNumero) {
    y += 10;
    y = asegurarEspacio(doc, y, 70).y;
    doc.setFillColor(...LILA_SUAVE);
    doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, 56, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CARBON);
    doc.text("Para completar tu pago", MARGEN + 16, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(
      `${datos.pagoMetodo ?? ""}  ${datos.pagoNumero}`.trim(),
      MARGEN + 16,
      y + 38
    );
    if (datos.pagoTitular) {
      doc.setFontSize(9);
      doc.setTextColor(...CARBON_SUAVE);
      doc.text(`a nombre de ${datos.pagoTitular}`, MARGEN + 16, y + 50);
    }
    y += 70;
  }

  // ---------- Mensaje de agradecimiento ----------
  // Los tipos base de jsPDF (Helvetica/Times) solo soportan WinAnsi: los
  // emoji (✨) y símbolos fuera de Latin-1 (♡) salen como glifos rotos, así
  // que aquí se usa texto plano en vez de los mismos íconos que en la web.
  const mensajeGracias = "¡Gracias por tu compra, princesa!";
  const mensajeGraciasSub = doc.splitTextToSize(
    "Tu confianza significa el mundo para nosotras. Cuida mucho tu pedido.",
    ancho - MARGEN * 2 - 32
  );
  const altoCajaGracias = 34 + mensajeGraciasSub.length * 13;

  y += 16;
  y = asegurarEspacio(doc, y, altoCajaGracias + 10).y;
  doc.setFillColor(...ROSA_NUBE);
  doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, altoCajaGracias, 10, 10, "F");
  doc.setFont("times", "bolditalic");
  doc.setFontSize(13);
  doc.setTextColor(...FUCSIA);
  doc.text(mensajeGracias, ancho / 2, y + 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...CARBON_SUAVE);
  doc.text(mensajeGraciasSub, ancho / 2, y + 38, { align: "center" });

  // ---------- Pie de página en todas las hojas ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    const altoPagina = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CARBON_SUAVE);
    doc.text(
      "Anaya Beauty · Belleza que te define",
      ancho / 2,
      altoPagina - 20,
      { align: "center" }
    );
    if (totalPaginas > 1) {
      doc.text(`${pagina}/${totalPaginas}`, ancho - MARGEN, altoPagina - 20, {
        align: "right",
      });
    }
  }

  return doc;
}

export async function descargarReciboPDF(datos: DatosRecibo): Promise<void> {
  const doc = await generarReciboPDF(datos);
  doc.save(`recibo-${datos.numero}.pdf`);
}
