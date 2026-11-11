import { jsPDF } from "jspdf";
import { pesos } from "@/lib/format";
import { PALETA } from "@/lib/marca";

/** Recibo en PDF del panel. Se genera en el navegador (jsPDF): sin servidor de por medio. */

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

type Rgb = [number, number, number];

/** jsPDF recibe los colores como tres números; la paleta es la de la web (lib/marca.ts). */
function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const TINTA = rgb(PALETA.tinta);
const TINTA_SUAVE = rgb(PALETA.tintaSuave);
const LINEA = rgb(PALETA.linea);
const SUPERFICIE = rgb(PALETA.superficie);

// public/marca/anaya-beauty.png: 349×160.
const LOGO = { ruta: "/marca/anaya-beauty.png", alto: 44, ancho: (44 * 349) / 160 };

async function cargarLogoBase64(): Promise<string | null> {
  try {
    const respuesta = await fetch(LOGO.ruta);
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
  doc.setFillColor(...SUPERFICIE);
  doc.rect(0, 0, ancho, ALTO_ENCABEZADO, "F");

  let conLogo = false;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGEN, 30, LOGO.ancho, LOGO.alto, undefined, "FAST");
      conLogo = true;
    } catch {
      // Sin logo (red, bloqueo) el recibo sale igual, con el nombre en texto.
    }
  }
  if (!conLogo) {
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Anaya Beauty", MARGEN, 58);
  }

  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Recibo ${datos.numero}`, ancho - MARGEN, 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text(
    datos.fecha.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Bogota",
    }),
    ancho - MARGEN,
    60,
    { align: "right" }
  );

  let y = ALTO_ENCABEZADO + 30;

  // ---------- Datos del cliente ----------
  doc.setFillColor(...SUPERFICIE);
  doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, 56, 8, 8, "F");
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(datos.clienteNombre || "Cliente", MARGEN + 16, y + 22);

  const detalleCliente = [datos.clienteCiudad, datos.clienteWhatsapp]
    .filter((v) => v && v.trim())
    .join("  ·  ");
  if (detalleCliente) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA_SUAVE);
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
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("PRODUCTO", xNombre, yTabla);
    doc.text("CANT.", xCantidad, yTabla, { align: "right" });
    doc.text("P. UNIT.", xPrecio, yTabla, { align: "right" });
    doc.text("SUBTOTAL", xSubtotal, yTabla, { align: "right" });
    const yLinea = yTabla + 6;
    doc.setDrawColor(...LINEA);
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
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(`Ref. ${linea.referencia}`, xNombre, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    doc.text(linea.nombre, xNombre, y + 13, { maxWidth: xCantidad - xNombre - 16 });

    // La etiqueta (tono, color, diseño) no viaja con la línea: va solo el nombre de la variante.
    if (linea.tono) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(linea.tono, xNombre, y + 26);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(String(linea.cantidad), xCantidad, y, { align: "right" });
    doc.text(pesos(linea.precioUnitario), xPrecio, y, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(pesos(linea.subtotal), xSubtotal, y, { align: "right" });

    y += linea.tono ? 36 : 30;
  }

  y += 6;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 22;

  // ---------- Totales ----------
  y = asegurarEspacio(doc, y, 110).y;

  function filaTotal(etiqueta: string, valor: string, destacado = false) {
    doc.setFont("helvetica", destacado ? "bold" : "normal");
    doc.setFontSize(destacado ? 14 : 10);
    doc.setTextColor(...(destacado ? TINTA : TINTA_SUAVE));
    doc.text(etiqueta, xPrecio, y, { align: "right" });
    doc.text(valor, xSubtotal, y, { align: "right" });
    y += destacado ? 22 : 16;
  }

  if (datos.porMayor || datos.descuento > 0) {
    filaTotal("Subtotal", pesos(datos.subtotal));
    if (datos.porMayor) filaTotal("Precio por mayor", "aplicado");
    if (datos.descuento > 0) {
      const etiqueta = datos.porcentaje > 0 ? `Descuento ${datos.porcentaje} %` : "Descuento";
      filaTotal(etiqueta, `-${pesos(datos.descuento)}`);
    }
  }
  filaTotal("Total", pesos(datos.total), true);

  // ---------- Datos de pago ----------
  if (datos.pagoNumero) {
    y += 10;
    y = asegurarEspacio(doc, y, 70).y;
    doc.setFillColor(...SUPERFICIE);
    doc.roundedRect(MARGEN, y, ancho - MARGEN * 2, 56, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
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
      doc.setTextColor(...TINTA_SUAVE);
      doc.text(`a nombre de ${datos.pagoTitular}`, MARGEN + 16, y + 50);
    }
    y += 70;
  }

  // ---------- Agradecimiento ----------
  // Helvetica de jsPDF solo trae WinAnsi: nada de emoji ni símbolos fuera de Latin-1.
  y += 16;
  y = asegurarEspacio(doc, y, 50).y;
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TINTA);
  doc.text("Gracias por comprar en Anaya Beauty.", ancho / 2, y + 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text("Si tienes alguna pregunta sobre tu pedido, escríbenos por WhatsApp.", ancho / 2, y + 38, {
    align: "center",
  });

  // ---------- Pie de página en todas las hojas ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    const altoPagina = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_SUAVE);
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
