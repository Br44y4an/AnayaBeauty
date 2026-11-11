import type { Metadata } from "next";
import { MisPedidos } from "@/components/tienda/MisPedidos";

export const metadata: Metadata = {
  title: "Mis pedidos",
  description: "Los pedidos que confirmaste desde este celular.",
};

export default function PaginaMisPedidos() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-tinta">Tus pedidos en este celular</h1>
      <MisPedidos />
    </main>
  );
}
