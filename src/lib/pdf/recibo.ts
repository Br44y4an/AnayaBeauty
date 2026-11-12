import { jsPDF } from "jspdf";
import {
  cierreDe,
  datosDePago,
  encabezadoDocumento,
  fechaLarga,
  filasDelTotal,
  lineasDestinatario,
  nombreArchivo,
  textoImprimible as t,
  type DatosRecibo,
} from "@/lib/admin/recibo";
import { pesos } from "@/lib/format";
import { PALETA } from "@/lib/marca";

/** Recibo en PDF del panel. Se genera en el navegador (jsPDF): sin servidor de por medio. */

export type { DatosRecibo, LineaRecibo } from "@/lib/admin/recibo";

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
const AHORRO = rgb(PALETA.ahorro);

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
const ALTO_PIE = 50;

export async function generarReciboPDF(datos: DatosRecibo): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const logo = await cargarLogoBase64();

  function letra(estilo: "normal" | "bold", tamano: number, color: Rgb = TINTA) {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tamano);
    doc.setTextColor(...color);
  }

  // Si no cabe lo que sigue, abre una página nueva; devuelve si la abrió.
  let y = 0;
  function asegurar(necesario: number): boolean {
    if (y + necesario <= altoPagina - ALTO_PIE) return false;
    doc.addPage();
    y = MARGEN + 10;
    return true;
  }

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
    letra("bold", 20);
    doc.text("Anaya Beauty", MARGEN, 58);
  }

  letra("bold", 13);
  const titulo: string[] = doc.splitTextToSize(t(encabezadoDocumento(datos.titulo, datos.numero)), util - LOGO.ancho - 24);
  titulo.slice(0, 3).forEach((renglon, i) => doc.text(renglon, ancho - MARGEN, 44 + i * 16, { align: "right" }));
  letra("normal", 10, TINTA_SUAVE);
  doc.text(fechaLarga(datos.fecha), ancho - MARGEN, 44 + Math.min(titulo.length, 3) * 16, { align: "right" });

  y = ALTO_ENCABEZADO + 30;

  // ---------- Dirigido a ----------
  letra("bold", 12);
  const nombre: string[] = doc.splitTextToSize(t(datos.destinatario.nombre) || "Cliente", util - 32);
  const detalle = lineasDestinatario(datos.destinatario).flatMap((l) => doc.splitTextToSize(t(l), util - 32) as string[]);
  const altoBloque = 34 + nombre.length * 15 + detalle.length * 14 + 6;
  doc.setFillColor(...SUPERFICIE);
  doc.roundedRect(MARGEN, y, util, altoBloque, 8, 8, "F");
  letra("bold", 8, TINTA_SUAVE);
  doc.text("DIRIGIDO A", MARGEN + 16, y + 18);
  let yBloque = y + 36;
  letra("bold", 12);
  for (const renglon of nombre) {
    doc.text(renglon, MARGEN + 16, yBloque);
    yBloque += 15;
  }
  letra("normal", 10, TINTA_SUAVE);
  for (const renglon of detalle) {
    doc.text(renglon, MARGEN + 16, yBloque);
    yBloque += 14;
  }
  y += altoBloque + 24;

  // ---------- Tabla de productos ----------
  const xNombre = MARGEN;
  const xCantidad = ancho - MARGEN - 170;
  const xPrecio = ancho - MARGEN - 90;
  const xSubtotal = ancho - MARGEN;
  const anchoNombre = xCantidad - xNombre - 30;

  function encabezadoTabla() {
    letra("bold", 9, TINTA_SUAVE);
    doc.text("PRODUCTO", xNombre, y);
    doc.text("CANT.", xCantidad, y, { align: "right" });
    doc.text("P. UNIT.", xPrecio, y, { align: "right" });
    doc.text("SUBTOTAL", xSubtotal, y, { align: "right" });
    doc.setDrawColor(...LINEA);
    doc.line(MARGEN, y + 6, ancho - MARGEN, y + 6);
    y += 24;
  }

  encabezadoTabla();

  for (const linea of datos.lineas) {
    const referencia = linea.referencia ? `Ref. ${t(linea.referencia)}` : null;
    letra("normal", 10);
    const renglones: string[] = doc.splitTextToSize(t(linea.nombre), anchoNombre);
    const tono = linea.tono ? t(linea.tono) : null;
    const alto = (referencia ? 13 : 0) + renglones.length * 13 + (tono ? 13 : 0) + 4;
    if (asegurar(alto + 4)) encabezadoTabla();

    // Las cifras van en el primer renglón de la fila, con o sin «Ref.».
    letra("normal", 10);
    doc.text(String(linea.cantidad), xCantidad, y, { align: "right" });
    doc.text(pesos(linea.precioUnitario), xPrecio, y, { align: "right" });
    letra("bold", 10);
    doc.text(pesos(linea.subtotal), xSubtotal, y, { align: "right" });

    let yFila = y;
    if (referencia) {
      letra("bold", 9, TINTA_SUAVE);
      doc.text(referencia, xNombre, yFila);
      yFila += 13;
    }
    letra("normal", 10);
    for (const renglon of renglones) {
      doc.text(renglon, xNombre, yFila);
      yFila += 13;
    }
    if (tono) {
      letra("bold", 9);
      doc.text(tono, xNombre, yFila);
    }
    y += alto + 10;
  }

  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y - 4, ancho - MARGEN, y - 4);
  y += 18;

  // ---------- Totales ----------
  const filas = filasDelTotal(datos);
  asegurar(filas.length * 18 + 10);
  for (const fila of filas) {
    const total = fila.tipo === "total";
    letra(total ? "bold" : "normal", total ? 14 : 10, total ? TINTA : fila.tipo === "ahorro" ? AHORRO : TINTA_SUAVE);
    doc.text(fila.etiqueta, xPrecio, y, { align: "right" });
    doc.text(fila.valor, xSubtotal, y, { align: "right" });
    y += total ? 22 : 16;
  }

  // ---------- Datos de pago ----------
  const pago = datosDePago(datos);
  if (pago) {
    y += 10;
    asegurar(70);
    doc.setFillColor(...SUPERFICIE);
    doc.roundedRect(MARGEN, y, util, 56, 8, 8, "F");
    letra("bold", 10);
    doc.text("Para completar tu pago", MARGEN + 16, y + 20);
    letra("normal", 12);
    doc.text(t(pago.cuenta), MARGEN + 16, y + 38);
    if (pago.titular) {
      letra("normal", 9, TINTA_SUAVE);
      doc.text(t(pago.titular), MARGEN + 16, y + 50);
    }
    y += 70;
  }

  // ---------- Nota al pie o agradecimiento ----------
  // Helvetica de jsPDF solo trae WinAnsi: los textos de la administradora pasan por textoImprimible.
  // La nota (400 caracteres como máximo) cabe en una hoja: va entera con su línea, sin renglones sueltos.
  const cierre = cierreDe(t(datos.nota));
  letra("normal", 10);
  const renglones = cierre.tipo === "nota" ? cierre.parrafos.flatMap((p) => doc.splitTextToSize(p, util) as string[]) : [];
  y += 16;
  asegurar(Math.max(50, 22 + renglones.length * 14));
  doc.setDrawColor(...LINEA);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 22;
  if (cierre.tipo === "nota") {
    letra("normal", 10);
    for (const renglon of renglones) {
      doc.text(renglon, MARGEN, y);
      y += 14;
    }
  } else {
    letra("bold", 11);
    doc.text(cierre.titulo, ancho / 2, y, { align: "center" });
    letra("normal", 9.5, TINTA_SUAVE);
    doc.text(cierre.detalle, ancho / 2, y + 16, { align: "center" });
  }

  // ---------- Pie de página en todas las hojas ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    letra("normal", 8, TINTA_SUAVE);
    doc.text("Anaya Beauty · Belleza que te define", ancho / 2, altoPagina - 20, { align: "center" });
    if (totalPaginas > 1) doc.text(`${pagina}/${totalPaginas}`, ancho - MARGEN, altoPagina - 20, { align: "right" });
  }

  return doc;
}

/** El PDF como archivo, con el nombre del documento: sirve para descargarlo o compartirlo. */
export async function generarArchivoRecibo(datos: DatosRecibo): Promise<File> {
  const doc = await generarReciboPDF(datos);
  return new File([doc.output("blob")], nombreArchivo(datos.titulo, datos.numero), { type: "application/pdf" });
}

export async function descargarReciboPDF(datos: DatosRecibo): Promise<void> {
  const doc = await generarReciboPDF(datos);
  doc.save(nombreArchivo(datos.titulo, datos.numero));
}
