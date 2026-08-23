import { NextResponse } from "next/server";

/**
 * Link mágico: la administradora comparte /c/4821 por WhatsApp y con un
 * toque la clienta llega a la confirmación con el código ya aplicado.
 * Esto elimina el ir y venir entre el chat y la web.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const limpio = codigo.replace(/\D/g, "").slice(0, 4);

  const destino = limpio.length === 4 ? `/confirmar?codigo=${limpio}` : "/carrito";

  // Se usa el origen de la petición para que el link funcione igual en
  // local, en la vista previa de Vercel y en producción.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(peticion.url).origin;

  return NextResponse.redirect(new URL(destino, base));
}
