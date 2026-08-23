import type { Metadata } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" className={`${playfair.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
