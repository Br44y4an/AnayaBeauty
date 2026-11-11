function comoUrl(valor: string | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Dirección pública del sitio, sin barra final (QR, metadataBase, enlaces absolutos). */
export function urlSitio(): string {
  // En el navegador Next solo incrusta las NEXT_PUBLIC_*: por eso va también la copia pública de Vercel.
  return (
    comoUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    comoUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    comoUrl(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ??
    "http://localhost:3000"
  );
}
