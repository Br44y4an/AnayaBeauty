import type { NextConfig } from "next";

/** Solo se optimizan las fotos del bucket de este proyecto, nunca imágenes ajenas. */
const supabase = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xvqqeedtdpqlfaaicymz.supabase.co"
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabase.hostname,
        port: "",
        pathname: "/storage/v1/object/public/productos/**",
        search: "",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800,
  },

  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },

  // Enlaces viejos (código de 4 dígitos) que siguen en chats de WhatsApp. Van
  // aquí y no en una página con redirect(): esa se prerenderiza y cae en un
  // meta refresh de 1 s en vez de un 307 inmediato.
  async redirects() {
    return [
      { source: "/confirmar", destination: "/carrito", permanent: false },
      { source: "/c/:codigo", destination: "/carrito", permanent: false },
    ];
  },
};

export default nextConfig;
