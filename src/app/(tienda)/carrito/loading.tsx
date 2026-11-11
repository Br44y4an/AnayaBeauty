import { EsqueletoBolsa } from "@/components/bolsa/VistaBolsa";

/** El título es el mismo que pinta la bolsa: solo cambia el contenido al llegar. */
export default function CargandoBolsa() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:px-6 md:pt-10 xl:px-8">
      <div className="flex items-baseline gap-3 pb-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Tu bolsa</h1>
      </div>
      <EsqueletoBolsa />
    </main>
  );
}
