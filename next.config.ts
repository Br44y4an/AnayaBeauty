import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  /**
   * Rutas que quedaron atrás con la v4.
   *
   * Confirmar era una pantalla aparte porque había que escribir el código
   * de 4 dígitos, y `/c/4821` era el "link mágico" que lo aplicaba solo.
   * Sin códigos, las dos llevan a la bolsa, donde ahora se hace todo.
   *
   * Van aquí y no como páginas con `redirect()` por un motivo concreto:
   * una página que solo redirige se prerenderiza, y entonces Next no
   * puede responder con un 307 —tiene que caer en un
   * `<meta http-equiv="refresh" content="1;url=...">`, que deja a la
   * clienta un segundo entero mirando una pantalla en blanco. Desde la
   * configuración el redirección la hace el servidor, al instante.
   *
   * Siguen existiendo porque hay enlaces repartidos por chats de WhatsApp
   * que apuntan ahí, y un 404 en mitad de una compra es una venta menos.
   */
  async redirects() {
    return [
      { source: "/confirmar", destination: "/carrito", permanent: false },
      { source: "/c/:codigo", destination: "/carrito", permanent: false },
    ];
  },
};

export default nextConfig;
