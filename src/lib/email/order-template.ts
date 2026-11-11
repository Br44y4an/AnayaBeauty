import { pesos } from "@/lib/format";
import { PALETA } from "@/lib/marca";

export type DatosCorreo = {
  numeroPedido: string;
  nombre: string;
  whatsapp: string;
  ciudad: string;
  /** La nota de la clienta («es un regalo», «[Adicional a AB-0098] …»). */
  notas: string | null;
  subtotal: number;
  descuento: number;
  porcentaje: number;
  porMayor: boolean;
  total: number;
  lineas: {
    referencia: string;
    nombre: string;
    tono: string | null;
    cantidad: number;
    subtotal: number;
  }[];
  /** Origen desde el que se confirmó; si falta se usa NEXT_PUBLIC_SITE_URL. */
  sitio?: string | null;
};

/** Los datos vienen de un formulario público: siempre se escapan. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BORDE = `border-bottom:1px solid ${PALETA.linea}`;

function filaProducto(l: DatosCorreo["lineas"][number]): string {
  const tono = l.tono
    ? `<br><span style="color:${PALETA.tintaSuave};font-size:13px;">Tono: ${escapar(l.tono)}</span>`
    : "";
  return `
        <tr>
          <td style="padding:12px 0;${BORDE};">
            <span style="color:${PALETA.tintaSuave};font-size:12px;">Ref. ${escapar(l.referencia)}</span><br>
            <span style="color:${PALETA.tinta};font-size:15px;">${escapar(l.nombre)}</span>${tono}
          </td>
          <td style="padding:12px 8px;${BORDE};text-align:center;color:${PALETA.tinta};white-space:nowrap;">× ${l.cantidad}</td>
          <td style="padding:12px 0;${BORDE};text-align:right;color:${PALETA.tinta};font-weight:bold;white-space:nowrap;">${pesos(l.subtotal)}</td>
        </tr>`;
}

function filaResumen(etiqueta: string, valor: string, color: string = PALETA.tintaSuave): string {
  return `
        <tr>
          <td colspan="2" style="padding-top:8px;font-size:14px;color:${color};">${etiqueta}</td>
          <td style="padding-top:8px;text-align:right;font-size:14px;color:${color};white-space:nowrap;">${valor}</td>
        </tr>`;
}

export function plantillaCorreoPedido(datos: DatosCorreo): string {
  const sitio = (datos.sitio ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const filas = datos.lineas.map(filaProducto).join("");

  // El desglose solo aparece si hubo algún beneficio: sin él serían líneas en cero.
  const desglose =
    datos.porMayor || datos.porcentaje > 0
      ? [
          filaResumen("Subtotal", pesos(datos.subtotal)),
          datos.porMayor ? filaResumen("Precio por mayor aplicado", "sí", PALETA.ahorro) : "",
          datos.porcentaje > 0
            ? filaResumen(`Descuento ${datos.porcentaje} %`, `−${pesos(datos.descuento)}`, PALETA.ahorro)
            : "",
        ].join("")
      : "";

  const nota = datos.notas
    ? `<br><br><span style="color:${PALETA.tintaSuave};font-size:13px;"><strong>Nota de la clienta:</strong><br>${escapar(datos.notas)}</span>`
    : "";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:${PALETA.superficie};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${PALETA.fondo};border-radius:8px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 4px;color:${PALETA.firma};font-size:12px;font-weight:bold;letter-spacing:2px;">ANAYA BEAUTY</p>
      <h1 style="margin:0 0 20px;color:${PALETA.tinta};font-size:24px;">Pedido ${escapar(datos.numeroPedido)}</h1>

      <table role="presentation" width="100%" style="background:${PALETA.superficie};border-radius:8px;padding:16px;margin-bottom:20px;">
        <tr><td style="color:${PALETA.tinta};font-size:14px;line-height:1.7;">
          <strong>${escapar(datos.nombre)}</strong><br>
          WhatsApp: ${escapar(datos.whatsapp)}<br>
          Ciudad: ${escapar(datos.ciudad)}${nota}
        </td></tr>
      </table>

      <table role="presentation" width="100%" style="border-collapse:collapse;">
        ${filas}
        ${desglose}
        <tr>
          <td colspan="2" style="padding-top:16px;font-size:16px;font-weight:bold;color:${PALETA.tinta};">Total productos</td>
          <td style="padding-top:16px;text-align:right;font-size:20px;color:${PALETA.tinta};font-weight:bold;white-space:nowrap;">${pesos(datos.total)}</td>
        </tr>
      </table>

      <p style="margin-top:28px;text-align:center;">
        <a href="${escapar(sitio)}/admin"
           style="display:inline-block;background:${PALETA.acento};color:${PALETA.fondo};text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;">
          Ver en el panel
        </a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
