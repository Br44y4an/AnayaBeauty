"use client";

/**
 * Último recurso: se muestra cuando el fallo ocurre en el propio layout
 * raíz, donde `error.tsx` ya no alcanza. Tiene que traer su propio
 * <html> y <body> y no puede depender de estilos del proyecto.
 */
export default function ErrorDeRaiz({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-CO">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#fdf2f7",
          color: "#3d2b36",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Algo se nos enredó</h1>
        <p style={{ margin: 0, color: "#6d5765", maxWidth: "22rem" }}>
          Vuelve a intentarlo en un momento. Si sigue igual, escríbenos por
          WhatsApp y te tomamos el pedido a mano.
        </p>
        <button
          onClick={reset}
          style={{
            minHeight: "52px",
            padding: "0 2rem",
            borderRadius: "9999px",
            border: "none",
            background: "#e5308a",
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Intentar de nuevo
        </button>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#6d5765" }}>
            Referencia: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
