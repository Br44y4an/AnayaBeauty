import { Suspense } from "react";
import Link from "next/link";
import { FormularioConfirmar } from "./FormularioConfirmar";
import { IconoFlechaIzquierda } from "@/components/ui/Iconos";

export const metadata = { title: "Confirmar pedido — Anaya Beauty" };

export default function PaginaConfirmar() {
  return (
    <main className="mx-auto max-w-md px-4 pb-32">
      <Link
        href="/carrito"
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 py-4
                   text-sm font-semibold text-lila transition hover:text-fucsia"
      >
        <IconoFlechaIzquierda className="h-4 w-4" />
        Volver a mi pedido
      </Link>

      <h1 className="pb-1 font-display text-3xl text-carbon">Ya casi es tuyo ✨</h1>
      <p className="pb-6 text-sm text-carbon-suave">
        Ingresa tu código y tus datos para confirmar.
      </p>

      <Suspense fallback={<p className="text-carbon-suave">Cargando…</p>}>
        <FormularioConfirmar />
      </Suspense>
    </main>
  );
}
