import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--fuente-figtree",
  display: "swap",
});

function urlDelSitio(): URL | undefined {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: urlDelSitio(),
  title: {
    default: "Anaya Beauty — Maquillaje y accesorios",
    template: "%s · Anaya Beauty",
  },
  description:
    "Maquillaje y accesorios con precio por cantidad. Haz tu pedido aquí y coordinamos el pago por WhatsApp.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Nunca se bloquea el zoom: para quien no ve bien de cerca, ampliar es poder comprar.
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <html lang="es-CO" className={figtree.variable}>
      <body className="bg-fondo text-tinta">
        {children}
        {modal}
      </body>
    </html>
  );
}
