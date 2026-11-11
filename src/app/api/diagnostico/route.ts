import { clavesIguales } from "@/lib/clave-segura";
import { enviarCorreoPedido } from "@/lib/email/send-order";
import { clienteAdmin } from "@/lib/supabase/admin";

// Revisa variables, base y, solo con ?correo=1, el envío de un correo real. Sin la clave correcta en la
// cabecera responde 404, como si la ruta no existiera:
//   curl -H "x-clave-diagnostico: <tu-clave-de-diagnóstico>" "https://EL-SITIO/api/diagnostico?correo=1"

const SIN_CACHE = { "Cache-Control": "no-store" };

/** El final y el largo de un secreto: basta para compararlo con el tuyo sin exponerlo. */
function huella(valor: string | undefined): string {
  if (!valor) return "FALTA";
  const largo = `${valor.length} caracteres`;
  return valor.length < 20 ? `definida (${largo})` : `…${valor.slice(-4)} (${largo})`;
}

async function revisarBase() {
  try {
    const { count, error } = await clienteAdmin()
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("activo", true);
    return error ? { ok: false, error: error.message } : { ok: true, productosActivos: count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error desconocido" };
  }
}

async function enviarCorreoDePrueba() {
  const resultado = await enviarCorreoPedido({
    numeroPedido: "AB-PRUEBA",
    nombre: "Pedido de prueba del sistema",
    whatsapp: "3001234567",
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
  return resultado.ok
    ? { ok: true, id: resultado.id, mensaje: "Enviado con la plantilla real: revisa la bandeja de entrada." }
    : { ok: false, motivo: resultado.motivo };
}

export async function GET(request: Request) {
  const clave = request.headers.get("x-clave-diagnostico");
  if (!clavesIguales(process.env.CLAVE_DIAGNOSTICO ?? null, clave)) {
    return new Response(null, { status: 404, headers: SIN_CACHE });
  }

  const conCorreo = new URL(request.url).searchParams.get("correo") === "1";

  return Response.json(
    {
      revisado: new Date().toISOString(),
      variables: {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "FALTA",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "FALTA",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: huella(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: huella(process.env.SUPABASE_SERVICE_ROLE_KEY),
        RESEND_API_KEY: huella(process.env.RESEND_API_KEY),
        CORREO_DESTINO: process.env.CORREO_DESTINO ?? "FALTA",
        SAL_HASH_IP: process.env.SAL_HASH_IP ? "definida" : "FALTA",
      },
      baseDeDatos: await revisarBase(),
      correoDePrueba: conCorreo
        ? await enviarCorreoDePrueba()
        : "No se envió. Agrega ?correo=1 para enviar uno con la plantilla real.",
    },
    { headers: SIN_CACHE }
  );
}
