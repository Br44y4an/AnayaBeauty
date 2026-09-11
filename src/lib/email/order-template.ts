import { pesos } from "@/lib/format";

export type DatosCorreo = {
  numeroPedido: string;
  nombre: string;
  whatsapp: string;
  ciudad: string;
  /**
   * Indicaciones que la clienta escribió al confirmar.
   *
   * Sustituye al antiguo "código usado": ya no hay códigos, y en su
   * lugar el aviso lleva algo que de verdad le sirve a quien despacha
   * ("es un regalo", "timbre 302", "llamar antes").
   */
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
};

/** Los datos vienen de un formulario público: siempre se escapan. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plantillaCorreoPedido(datos: DatosCorreo): string {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const filas = datos.lineas
    .map(
      (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;">
            <span style="color:#8956B8;font-size:11px;font-weight:bold;">${escapar(l.referencia)}</span><br>
            <span style="color:#3D2B36;font-size:14px;">${escapar(l.nombre)}</span>
            ${
              l.tono
                ? `<br><span style="color:#D11A72;font-size:12px;font-weight:bold;">Tono: ${escapar(l.tono)}</span>`
                : ""
            }
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:center;color:#3D2B36;">
            x${l.cantidad}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:right;color:#D11A72;font-weight:bold;">
            ${pesos(l.subtotal)}
          </td>
        </tr>`
    )
    .join("");

  // El desglose solo aparece si hubo algún beneficio, para no llenar el
  // correo de líneas en cero.
  const hayBeneficio = datos.porMayor || datos.porcentaje > 0;

  const desglose = hayBeneficio
    ? `
        <tr>
          <td colspan="2" style="padding-top:12px;font-size:13px;color:#6D5765;">Subtotal</td>
          <td style="padding-top:12px;text-align:right;font-size:13px;color:#6D5765;">${pesos(datos.subtotal)}</td>
        </tr>
        ${
          datos.porMayor
            ? `<tr>
                 <td colspan="2" style="font-size:13px;color:#8956B8;font-weight:bold;">Precio por mayor aplicado</td>
                 <td style="text-align:right;font-size:13px;color:#8956B8;">sí</td>
               </tr>`
            : ""
        }
        ${
          datos.porcentaje > 0
            ? `<tr>
                 <td colspan="2" style="font-size:13px;color:#8956B8;font-weight:bold;">Descuento ${datos.porcentaje}%</td>
                 <td style="text-align:right;font-size:13px;color:#8956B8;">−${pesos(datos.descuento)}</td>
               </tr>`
            : ""
        }`
    : "";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#FDF2F7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#8956B8;font-size:12px;letter-spacing:2px;">ANAYA BEAUTY</p>
      <h1 style="margin:0 0 20px;color:#D11A72;font-size:26px;">Pedido ${escapar(datos.numeroPedido)}</h1>

      <table role="presentation" width="100%" style="background:#FDF2F7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <tr><td style="color:#3D2B36;font-size:14px;line-height:1.8;">
          <strong>${escapar(datos.nombre)}</strong><br>
          WhatsApp: ${escapar(datos.whatsapp)}<br>
          Ciudad: ${escapar(datos.ciudad)}${
            datos.notas
              ? `<br><br><span style="color:#6D5765;font-size:13px;"><strong>Nota de la clienta:</strong><br>${escapar(datos.notas)}</span>`
              : ""
          }
        </td></tr>
      </table>

      <table role="presentation" width="100%">
        ${filas}
        ${desglose}
        <tr>
          <td colspan="2" style="padding-top:16px;font-size:18px;color:#3D2B36;">TOTAL</td>
          <td style="padding-top:16px;text-align:right;font-size:22px;color:#D11A72;font-weight:bold;">
            ${pesos(datos.total)}
          </td>
        </tr>
      </table>

      <p style="margin-top:28px;text-align:center;">
        <a href="${sitio}/admin"
           style="display:inline-block;background:#E5308A;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;">
          Ver en el panel
        </a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
