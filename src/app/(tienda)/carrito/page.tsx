import type { Metadata } from "next";
import { VistaBolsa } from "@/components/bolsa/VistaBolsa";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";

export const metadata: Metadata = {
  title: "Tu bolsa",
  robots: { index: false, follow: true },
};

export default async function PaginaBolsa() {
  const { envioInfo, whatsappNegocio } = await obtenerConfiguracionPublica();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:px-6 md:pt-10 xl:px-8">
      <VistaBolsa envioInfo={envioInfo} whatsappNegocio={whatsappNegocio} />
    </main>
  );
}
