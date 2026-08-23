import Link from "next/link";
import { VistaCarrito } from "./VistaCarrito";
import { IconoFlechaIzquierda } from "@/components/ui/Iconos";

export const metadata = { title: "Mi pedido — Anaya Beauty" };

export default function PaginaCarrito() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-32">
      <Link
        href="/"
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 py-4
                   text-sm font-semibold text-lila transition hover:text-fucsia"
      >
        <IconoFlechaIzquierda className="h-4 w-4" />
        Seguir comprando
      </Link>

      <h1 className="pb-4 font-display text-3xl text-carbon">Mi pedido</h1>

      <VistaCarrito />
    </main>
  );
}
