import type { Metadata } from "next";
import Image from "next/image";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = {
  title: "Entrar al panel",
  robots: { index: false, follow: false },
};

export default function PaginaLogin() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Image
        src="/marca/anaya-beauty.png"
        alt="Anaya Beauty"
        width={349}
        height={160}
        unoptimized
        loading="eager"
        className="h-12 w-auto self-start"
      />

      <h1 className="mt-8 text-2xl font-semibold leading-[30px] text-tinta">Entrar al panel</h1>
      <p className="mt-1 text-[15px] leading-6 text-tinta-suave">Pedidos, productos y ajustes de la tienda.</p>

      <div className="mt-8">
        <FormularioLogin />
      </div>
    </main>
  );
}
