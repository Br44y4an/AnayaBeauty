"use client";

import { PALETA } from "@/lib/marca";
import { enlaceWhatsApp } from "@/lib/whatsapp";

// Sin globals.css ni Figtree (reemplaza al layout raíz): estilos propios con la paleta de lib/marca.ts.
const ESTILOS = `
  .ge-boton { display: flex; width: 100%; min-height: 52px; align-items: center; justify-content: center;
    border-radius: 8px; font-family: inherit; font-size: 16px; font-weight: 600; line-height: 20px; cursor: pointer; }
  .ge-primario { border: 0; background: ${PALETA.acento}; color: ${PALETA.fondo}; }
  .ge-primario:hover { background: ${PALETA.acentoHondo}; }
  .ge-secundario { border: 1px solid ${PALETA.tinta}; background: ${PALETA.fondo}; color: ${PALETA.tinta}; }
  .ge-secundario:hover { background: ${PALETA.superficie}; }
  :focus-visible { outline: 2px solid ${PALETA.acento}; outline-offset: 2px; }
`;

/** Último recurso cuando falla el propio layout raíz. */
export default function ErrorRaiz({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const codigo = error.digest ? ` (código ${error.digest})` : "";

  return (
    <html lang="es-CO">
      <head>
        <title>Algo no cargó bien · Anaya Beauty</title>
        <style>{ESTILOS}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 16px",
          boxSizing: "border-box",
          background: PALETA.fondo,
          color: PALETA.tinta,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        <main style={{ width: "100%", maxWidth: 400 }}>
          <img src="/marca/anaya-beauty.png" alt="Anaya Beauty" width={79} height={36} style={{ height: 36, width: "auto" }} />
          <h1 style={{ margin: "32px 0 0", fontSize: 24, lineHeight: "30px", fontWeight: 600 }}>Algo no cargó bien</h1>
          <p style={{ margin: "8px 0 0", color: PALETA.tintaSuave }}>Lo que tienes en tu bolsa sigue guardado.</p>

          <div style={{ marginTop: 32, display: "grid", gap: 12 }}>
            <button type="button" className="ge-boton ge-primario" onClick={() => retry()}>
              Volver a intentar
            </button>
            <button type="button" className="ge-boton ge-secundario" onClick={() => window.location.reload()}>
              Recargar la página
            </button>
          </div>

          <a
            href={enlaceWhatsApp(`Hola, el catálogo me mostró un error${codigo}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              minHeight: 44,
              alignItems: "center",
              marginTop: 20,
              color: PALETA.tinta,
              fontWeight: 600,
              textUnderlineOffset: 4,
            }}
          >
            Escríbenos por WhatsApp
          </a>

          {error.digest && (
            <p style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "18px", color: PALETA.tintaSuave }}>
              Código del error: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
