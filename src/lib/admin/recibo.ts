import { pesos } from "@/lib/format";
import { generarSlug } from "@/lib/slug";
import type { Pedido } from "@/lib/types";

/** Reglas del recibo del panel, sin React ni PDF: las usan el formulario, la vista previa y el PDF. */

export type Destinatario = { nombre: string; documento: string; whatsapp: string; ciudad: string; direccion: string };
export type LineaTexto = { id: string; descripcion: string; cantidad: number; precioUnitario: number };
export type PreferenciasRecibo = { titulo: string; nota: string; mostrarPago: boolean };
export type CampoLineaTexto = "descripcion" | "cantidad" | "precioUnitario";

/** Una fila del recibo; sin `referencia` es un producto escrito a mano (envío, servicio). */
export type LineaRecibo = {
  referencia?: string | null;
  nombre: string;
  tono?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

/** Lo que reciben por igual la vista previa y el PDF. */
export type DatosRecibo = {
  titulo: string;
  numero: string;
  fecha: Date;
  destinatario: Destinatario;
  lineas: LineaRecibo[];
  subtotal: number;
  descuento: number;
  porcentaje: number;
  porMayor: boolean;
  total: number;
  nota: string;
  mostrarPago: boolean;
  pagoMetodo?: string | null;
  pagoNumero?: string | null;
  pagoTitular?: string | null;
};

export type FilaTotal = { etiqueta: string; valor: string; tipo: "normal" | "ahorro" | "total" };
export type Cierre =
  | { tipo: "nota"; parrafos: string[] }
  | { tipo: "cierre"; titulo: string; detalle: string };

export const LARGO = {
  titulo: 40,
  nota: 400,
  descripcion: 120,
  numero: 30,
  nombre: 80,
  documento: 30,
  whatsapp: 20,
  ciudad: 60,
  direccion: 120,
} as const;

const CANTIDAD_MAXIMA = 9999;
const PRECIO_MAXIMO = 999_999_999;

export const PREFERENCIAS_POR_DEFECTO: PreferenciasRecibo = { titulo: "Recibo", nota: "", mostrarPago: true };
export const DESTINATARIO_VACIO: Destinatario = { nombre: "", documento: "", whatsapp: "", ciudad: "", direccion: "" };

/** Lo que cierra el recibo cuando no hay nota al pie. */
export const CIERRE_POR_DEFECTO = {
  titulo: "Gracias por comprar en Anaya Beauty.",
  detalle: "Si tienes alguna pregunta sobre tu pedido, escríbenos por WhatsApp.",
} as const;

const CLAVE_PREFERENCIAS = "anaya-recibo-preferencias";

const REEMPLAZOS: [RegExp, string][] = [
  [/[“”„]/g, '"'],
  [/[‘’‚]/g, "'"],
  [/[–—−]/g, "-"],
  [/…/g, "..."],
  [/•/g, "·"],
];

/**
 * La Helvetica de jsPDF solo escribe Latin-1: un emoji o una comilla curva daña TODO el renglón.
 * Se cambia lo que tiene equivalente y se quita lo demás; los saltos de línea se conservan.
 */
export function textoImprimible(texto: string): string {
  let limpio = texto.normalize("NFC").replace(/\r\n?/g, "\n");
  for (const [de, a] of REEMPLAZOS) limpio = limpio.replace(de, a);
  return limpio
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function destinatarioDePedido(
  p: Pick<Pedido, "clienteNombre" | "clienteWhatsapp" | "clienteCiudad">
): Destinatario {
  return {
    ...DESTINATARIO_VACIO,
    nombre: (p.clienteNombre ?? "").trim(),
    whatsapp: (p.clienteWhatsapp ?? "").trim(),
    ciudad: (p.clienteCiudad ?? "").trim(),
  };
}

/** Renglones bajo el nombre, solo con lo que se llenó: documento, «ciudad · WhatsApp» y dirección. */
export function lineasDestinatario(d: Destinatario): string[] {
  const documento = d.documento.trim();
  return [
    documento ? `Documento: ${documento}` : "",
    [d.ciudad, d.whatsapp].map((v) => v.trim()).filter(Boolean).join(" · "),
    d.direccion.trim(),
  ].filter(Boolean);
}

/** «6000», «6.000» y «$ 6.000» son seis mil; con decimales o letras devuelve NaN en vez de adivinar. */
export function leerEntero(texto: string): number {
  const limpio = texto.replace(/[\s$]/g, "");
  if (/^\d+$/.test(limpio)) return Number(limpio);
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replaceAll(".", ""));
  return Number.NaN;
}

export function revisarLineaTexto(l: {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}): { campo: CampoLineaTexto; mensaje: string } | null {
  const descripcion = l.descripcion.trim();
  if (!descripcion) return { campo: "descripcion", mensaje: "Escribe qué producto o servicio es." };
  if (descripcion.length > LARGO.descripcion) {
    return { campo: "descripcion", mensaje: `La descripción admite hasta ${LARGO.descripcion} caracteres.` };
  }
  if (!Number.isInteger(l.cantidad) || l.cantidad < 1) {
    return { campo: "cantidad", mensaje: "La cantidad debe ser un número entero desde 1." };
  }
  if (l.cantidad > CANTIDAD_MAXIMA) return { campo: "cantidad", mensaje: "La cantidad máxima es 9.999." };
  if (!Number.isInteger(l.precioUnitario) || l.precioUnitario < 0) {
    return {
      campo: "precioUnitario",
      mensaje: "Escribe el precio en pesos, sin decimales. Si no se cobra, pon 0.",
    };
  }
  if (l.precioUnitario > PRECIO_MAXIMO) {
    return { campo: "precioUnitario", mensaje: "El precio máximo es $999.999.999." };
  }
  return null;
}

export function validarLineaTexto(l: { descripcion: string; cantidad: number; precioUnitario: number }): string | null {
  return revisarLineaTexto(l)?.mensaje ?? null;
}

/**
 * Los productos en texto se suman después del descuento: un envío no entra en el porcentaje ni en el
 * precio por mayor, y el descuento nunca pasa de lo que suman los productos del catálogo.
 */
export function totalesDeRecibo(o: {
  subtotalCatalogo: number;
  descuentoCatalogo: number;
  lineasTexto: LineaTexto[];
}): { subtotal: number; descuento: number; total: number } {
  const texto = o.lineasTexto.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
  const pedido = Number.isFinite(o.descuentoCatalogo) ? Math.round(o.descuentoCatalogo) : 0;
  const descuento = Math.min(Math.max(0, pedido), Math.max(0, o.subtotalCatalogo));
  const subtotal = o.subtotalCatalogo + texto;
  return { subtotal, descuento, total: subtotal - descuento };
}

/** Nunca lanza: sin almacenamiento (modo privado, servidor) valen las preferencias por defecto. */
export function leerPreferencias(): PreferenciasRecibo {
  try {
    const crudo = localStorage.getItem(CLAVE_PREFERENCIAS);
    const p = (crudo ? JSON.parse(crudo) : null) as Partial<PreferenciasRecibo> | null;
    if (!p || typeof p.titulo !== "string" || typeof p.nota !== "string" || typeof p.mostrarPago !== "boolean") {
      return PREFERENCIAS_POR_DEFECTO;
    }
    return {
      titulo: p.titulo.trim() ? p.titulo.slice(0, LARGO.titulo) : PREFERENCIAS_POR_DEFECTO.titulo,
      nota: p.nota.slice(0, LARGO.nota),
      mostrarPago: p.mostrarPago,
    };
  } catch {
    return PREFERENCIAS_POR_DEFECTO;
  }
}

export function guardarPreferencias(p: PreferenciasRecibo): void {
  try {
    localStorage.setItem(
      CLAVE_PREFERENCIAS,
      JSON.stringify({ titulo: p.titulo, nota: p.nota, mostrarPago: p.mostrarPago })
    );
  } catch {
    // Recordar es un extra: sin espacio o sin permiso, el recibo se arma igual.
  }
}

export function reciboListo(o: { destinatario: Destinatario; lineas: number }): boolean {
  return o.destinatario.nombre.trim() !== "" && o.lineas >= 1;
}

/** La explicación que acompaña a «Descargar PDF» deshabilitado; null si ya se puede. */
export function queFalta(o: { destinatario: Destinatario; lineas: number }): string | null {
  const faltas = [
    o.destinatario.nombre.trim() === "" ? "el nombre en «Dirigido a»" : "",
    o.lineas < 1 ? "agregar al menos un producto" : "",
  ].filter(Boolean);
  return faltas.length > 0 ? `Falta ${faltas.join(" y ")}.` : null;
}

/** AAAA-MM-DD del día en Bogotá: el servidor corre en UTC y a las 7 p. m. ya estaría en «mañana». */
export function hoyEnBogota(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/** El día del campo de fecha, a mediodía de Bogotá, para que ninguna zona horaria lo corra. */
export function fechaDeRecibo(iso: string, respaldo: Date = new Date()): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return respaldo;
  const fecha = new Date(`${iso}T12:00:00-05:00`);
  return Number.isNaN(fecha.getTime()) ? respaldo : fecha;
}

export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

export function numeroSugerido(hoy: string, azar: () => number = Math.random): string {
  return `REC-${hoy.replaceAll("-", "")}-${Math.floor(azar() * 900) + 100}`;
}

export function nombreArchivo(titulo: string, numero: string): string {
  const numeroLimpio = numero
    .normalize("NFD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${[generarSlug(titulo) || "recibo", numeroLimpio].filter(Boolean).join("-")}.pdf`;
}

export function encabezadoDocumento(titulo: string, numero: string): string {
  return `${titulo.trim() || PREFERENCIAS_POR_DEFECTO.titulo} ${numero.trim()}`.trim();
}

/** Subtotal y descuento solo cuando hay algo que restar; si no, basta el total. */
export function filasDelTotal(
  d: Pick<DatosRecibo, "subtotal" | "descuento" | "porcentaje" | "porMayor" | "total">,
  menos = "-"
): FilaTotal[] {
  const filas: FilaTotal[] = [];
  if (d.porMayor || d.descuento > 0) filas.push({ etiqueta: "Subtotal", valor: pesos(d.subtotal), tipo: "normal" });
  if (d.porMayor) filas.push({ etiqueta: "Precio por mayor", valor: "aplicado", tipo: "normal" });
  if (d.descuento > 0) {
    const etiqueta = d.porcentaje > 0 ? `Descuento ${d.porcentaje} %` : "Descuento";
    filas.push({ etiqueta, valor: `${menos}${pesos(d.descuento)}`, tipo: "ahorro" });
  }
  filas.push({ etiqueta: "Total", valor: pesos(d.total), tipo: "total" });
  return filas;
}

export function datosDePago(
  d: Pick<DatosRecibo, "mostrarPago" | "pagoMetodo" | "pagoNumero" | "pagoTitular">
): { cuenta: string; titular: string | null } | null {
  const numero = d.pagoNumero?.trim();
  if (!d.mostrarPago || !numero) return null;
  const titular = d.pagoTitular?.trim();
  return { cuenta: `${d.pagoMetodo?.trim() ?? ""} ${numero}`.trim(), titular: titular ? `a nombre de ${titular}` : null };
}

export function cierreDe(nota: string): Cierre {
  const parrafos = nota
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  return parrafos.length > 0 ? { tipo: "nota", parrafos } : { tipo: "cierre", ...CIERRE_POR_DEFECTO };
}
