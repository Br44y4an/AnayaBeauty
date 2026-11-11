import Image from "next/image";
import Link from "next/link";

// public/marca/anaya-beauty.png (scripts/generar-marca.mjs): 349×160, ≥2× el alto de pantalla.
const ANCHO = 349;
const ALTO = 160;

const ALTOS = {
  normal: "h-9 lg:h-10",
  pequena: "h-7",
} as const;

/** Logotipo «Anaya» + «BEAUTY» que lleva al inicio. */
export function Marca({
  className = "",
  tamano = "normal",
}: {
  className?: string;
  tamano?: "normal" | "pequena";
}) {
  return (
    <Link
      href="/"
      aria-label="Anaya Beauty, inicio"
      className={`inline-flex min-h-11 shrink-0 items-center rounded-sm ${className}`}
    >
      <Image
        src="/marca/anaya-beauty.png"
        alt=""
        width={ANCHO}
        height={ALTO}
        unoptimized
        loading="eager"
        className={`${ALTOS[tamano]} w-auto`}
      />
    </Link>
  );
}
