import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import { BotonFlotante } from "@/components/carrito/BotonFlotante";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--fuente-playfair",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--fuente-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anaya Beauty — Belleza que te define",
  description:
    "Catálogo digital de maquillaje. Encuentra tus mejores productos y excelentes valores.",
  // Los iconos ya no se declaran a mano: Next usa los archivos
  // `icon.png`, `apple-icon.png` y `favicon.ico` de `src/app/`. El
  // `/logo.jpg` que había aquí los tapaba con una foto sin recortar.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Nunca se bloquea el zoom: para quien no ve de cerca, poder ampliar
  // la pantalla es la diferencia entre poder comprar y no poder.
  maximumScale: 5,
  themeColor: "#fdf2f7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" className={`${playfair.variable} ${nunito.variable}`}>
      <body>
        {children}
        <BotonFlotante />
      </body>
    </html>
  );
}
