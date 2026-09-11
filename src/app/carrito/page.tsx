import Link from "next/link";
import { VistaCarrito } from "./VistaCarrito";
import { IconoFlechaIzquierda } from "@/components/ui/Iconos";

export const metadata = { title: "Mi pedido — Anaya Beauty" };

export default function PaginaCarrito() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-40">
      <Link
        href="/"
        className="inline-flex min-h-[52px] cursor-pointer items-center gap-1.5 py-4
                   font-semibold text-lila-texto transition hover:text-fucsia-texto"
      >
        <IconoFlechaIzquierda className="h-5 w-5" />
        Seguir comprando
      </Link>

      <h1 className="pb-4 font-display text-3xl text-carbon">Mi pedido</h1>

      <VistaCarrito />
    </main>
  );
}
