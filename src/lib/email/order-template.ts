import { pesos } from "@/lib/format";

export type DatosCorreo = {
  numeroPedido: string;
  nombre: string;
  whatsapp: string;
  ciudad: string;
  codigo: string;
  total: number;
  lineas: {
    referencia: string;
    nombre: string;
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
            <span style="color:#A97FD0;font-size:11px;font-weight:bold;">${escapar(l.referencia)}</span><br>
            <span style="color:#3D2B36;font-size:14px;">${escapar(l.nombre)}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:center;color:#3D2B36;">
            x${l.cantidad}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:right;color:#E5308A;font-weight:bold;">
            ${pesos(l.subtotal)}
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#FDF2F7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#A97FD0;font-size:12px;letter-spacing:2px;">ANAYA BEAUTY</p>
      <h1 style="margin:0 0 20px;color:#E5308A;font-size:26px;">Pedido ${escapar(datos.numeroPedido)}</h1>

      <table role="presentation" width="100%" style="background:#FDF2F7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <tr><td style="color:#3D2B36;font-size:14px;line-height:1.8;">
          <strong>${escapar(datos.nombre)}</strong><br>
          WhatsApp: ${escapar(datos.whatsapp)}<br>
          Ciudad: ${escapar(datos.ciudad)}<br>
          <span style="color:#7A6470;font-size:12px;">Código usado: ${escapar(datos.codigo)}</span>
        </td></tr>
      </table>

      <table role="presentation" width="100%">
        ${filas}
        <tr>
          <td colspan="2" style="padding-top:16px;font-size:18px;color:#3D2B36;">TOTAL</td>
          <td style="padding-top:16px;text-align:right;font-size:22px;color:#E5308A;font-weight:bold;">
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
