/**
 * Envía un correo de prueba con un pedido de ejemplo.
 * Uso: node --env-file=.env.local scripts/probar-correo.mjs
 */
import { Resend } from "resend";

const clave = process.env.RESEND_API_KEY;
const destino = process.env.CORREO_DESTINO;

if (!clave || !destino) {
  console.error("✗ Falta RESEND_API_KEY o CORREO_DESTINO en .env.local");
  process.exit(1);
}

// Misma plantilla que usa la aplicación, replicada aquí para poder
// ejecutarla con node sin pasar por el compilador de Next.
const pesos = (v) => `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v)}`;

const lineas = [
  { referencia: "REF-101", nombre: "Labial Rojo Pasión", cantidad: 3, subtotal: 27000 },
  { referencia: "REF-233", nombre: "Rubor Durazno", cantidad: 1, subtotal: 12000 },
  { referencia: "REF-410", nombre: "Base Mate Natural", cantidad: 1, subtotal: 35000 },
];

const filas = lineas
  .map(
    (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;">
          <span style="color:#A97FD0;font-size:11px;font-weight:bold;">${l.referencia}</span><br>
          <span style="color:#3D2B36;font-size:14px;">${l.nombre}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:center;color:#3D2B36;">x${l.cantidad}</td>
        <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:right;color:#E5308A;font-weight:bold;">${pesos(l.subtotal)}</td>
      </tr>`
  )
  .join("");

const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#FDF2F7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#A97FD0;font-size:12px;letter-spacing:2px;">ANAYA BEAUTY</p>
      <h1 style="margin:0 0 20px;color:#E5308A;font-size:26px;">Pedido AB-0001</h1>
      <p style="margin:0 0 16px;padding:10px;background:#DDC9EE;border-radius:8px;color:#3D2B36;font-size:13px;">
        ✅ Este es un correo de PRUEBA. Si lo estás leyendo, los avisos de pedido funcionan.
      </p>
      <table role="presentation" width="100%" style="background:#FDF2F7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <tr><td style="color:#3D2B36;font-size:14px;line-height:1.8;">
          <strong>Laura Gómez (ejemplo)</strong><br>
          WhatsApp: 3001234567<br>
          Ciudad: Medellín<br>
          <span style="color:#7A6470;font-size:12px;">Código usado: 4821</span>
        </td></tr>
      </table>
      <table role="presentation" width="100%">
        ${filas}
        <tr>
          <td colspan="2" style="padding-top:16px;font-size:18px;color:#3D2B36;">TOTAL</td>
          <td style="padding-top:16px;text-align:right;font-size:22px;color:#E5308A;font-weight:bold;">${pesos(74000)}</td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const resend = new Resend(clave);

const { data, error } = await resend.emails.send({
  from: "Anaya Beauty <onboarding@resend.dev>",
  to: destino,
  subject: "Pedido AB-0001 — Laura Gómez — $74.000 (PRUEBA)",
  html,
});

if (error) {
  console.error("✗ No se pudo enviar:", JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log(`✓ Correo enviado a ${destino}`);
console.log(`  id: ${data.id}`);
console.log("\nRevisa la bandeja de entrada (y la carpeta de spam la primera vez).");
