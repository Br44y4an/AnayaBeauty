import type { Metadata } from "next";
import type { ReactNode } from "react";
import { exigirAdmin } from "@/lib/admin/sesion";
import { contarPedidosNuevos } from "@/lib/data/orders";
import { Avisos } from "@/components/ui/Avisos";
import { NavegacionPanel } from "./NavegacionPanel";
import { PedidosEnVivo } from "./PedidosEnVivo";

export const metadata: Metadata = {
  title: { default: "Panel · Anaya Beauty", template: "%s · Panel Anaya Beauty" },
  robots: { index: false, follow: false },
};

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  await exigirAdmin();
  // Sin la cuenta la navegación sigue sirviendo; el error real lo muestra la página de pedidos.
  const nuevos = await contarPedidosNuevos().catch(() => 0);

  return (
    <PedidosEnVivo abiertoDesde={Date.now()} nuevos={nuevos}>
      <div className="min-h-dvh bg-fondo lg:pl-60">
        <NavegacionPanel />
        <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      {/* Los avisos se apoyan sobre la barra inferior del celular (64 px + borde); en escritorio no hay barra. */}
      <div className="[--alto-pie-fijo:65px] lg:[--alto-pie-fijo:0px]">
        <Avisos />
      </div>
    </PedidosEnVivo>
  );
}
