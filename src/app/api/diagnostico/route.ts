import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { enviarCorreoPedido } from "@/lib/email/send-order";

/**
 * Diagnóstico de la instalación. Comprueba que la configuración esté
 * completa, que la base responda y, si se pide, que el correo salga.
 *
 * Protegida con la clave CLAVE_DIAGNOSTICO, que va en la cabecera
 * x-clave-diagnostico. Sin ella devuelve 401 y no revela nada.
 *
 *   curl -H "x-clave-diagnostico: ..." https://EL-SITIO/api/diagnostico
 *   curl -H "x-clave-diagnostico: ..." "https://EL-SITIO/api/diagnostico?correo=1"
 */
export const dynamic = "force-dynamic";

/** Muestra solo las puntas de un secreto, para poder compararlo sin exponerlo. */
function huella(valor: string | undefined): string {
  if (!valor) return "FALTA";
  if (valor.length <= 12) return `${valor.slice(0, 3)}…(${valor.length})`;
  return `${valor.slice(0, 8)}…${valor.slice(-4)} (${valor.length})`;
}

export async function GET(peticion: Request) {
  const esperada = process.env.CLAVE_DIAGNOSTICO;
  const recibida = peticion.headers.get("x-clave-diagnostico");

  if (!esperada || recibida !== esperada) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const url = new URL(peticion.url);
  const revisiones: Record<string, unknown> = {};

  // --- Configuración presente ---
  revisiones.variables = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "FALTA",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "FALTA",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: huella(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: huella(process.env.SUPABASE_SERVICE_ROLE_KEY),
    RESEND_API_KEY: huella(process.env.RESEND_API_KEY),
    CORREO_DESTINO: process.env.CORREO_DESTINO ?? "FALTA",
    SAL_HASH_IP: process.env.SAL_HASH_IP ? "definida" : "FALTA",
  };

  // --- La base responde ---
  try {
    const supabase = clienteAdmin();
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);

    revisiones.baseDeDatos = error
      ? { ok: false, error: error.message }
      : { ok: true, productosActivos: count };
  } catch (e) {
    revisiones.baseDeDatos = {
      ok: false,
      error: e instanceof Error ? e.message : "error desconocido",
    };
  }

  // --- Resend acepta la clave ---
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Anaya Beauty <onboarding@resend.dev>",
          to: [process.env.CORREO_DESTINO],
          subject: "prueba",
          html: "<p>prueba</p>",
        }),
      });

      const cuerpo = await r.json();

      revisiones.resend = r.ok
        ? { ok: true, mensaje: "la clave funciona y acepta el destinatario", id: cuerpo.id }
        : { ok: false, estado: r.status, respuesta: cuerpo };
    } catch (e) {
      revisiones.resend = {
        ok: false,
        error: e instanceof Error ? e.message : "error desconocido",
      };
    }
  } else {
    revisiones.resend = { ok: false, error: "RESEND_API_KEY no está definida" };
  }

  // --- Correo completo con la plantilla real ---
  if (url.searchParams.get("correo") === "1") {
    const resultado = await enviarCorreoPedido({
      numeroPedido: "AB-PRUEBA",
      nombre: "Pedido de prueba del sistema",
      whatsapp: "3228813646",
      ciudad: "Medellín",
      notas: "Nota de prueba: verificando que el aviso llegue completo.",
      subtotal: 74000,
      descuento: 3700,
      porcentaje: 5,
      porMayor: false,
      total: 70300,
      lineas: [
        { referencia: "REF-101", nombre: "Labial Rojo Pasión", tono: "Cereza", cantidad: 3, subtotal: 27000 },
        { referencia: "REF-233", nombre: "Rubor Durazno", tono: null, cantidad: 1, subtotal: 12000 },
        { referencia: "REF-410", nombre: "Base Mate Natural", tono: null, cantidad: 1, subtotal: 35000 },
      ],
    });

    // Se reporta lo que realmente pasó: antes esta línea decía "enviado"
    // aunque Resend hubiera rechazado el correo, que es justo el caso que
    // se estaba tratando de diagnosticar.
    revisiones.correoDePrueba = resultado.ok
      ? { ok: true, id: resultado.id, mensaje: "enviado con la plantilla real; revisa la bandeja" }
      : { ok: false, motivo: resultado.motivo };
  }

  return NextResponse.json({ revisado: new Date().toISOString(), ...revisiones });
}
