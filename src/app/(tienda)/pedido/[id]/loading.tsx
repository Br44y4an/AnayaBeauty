import { Esqueleto } from "@/components/ui/Esqueleto";

/** Misma forma que el pedido (encabezado, «Cómo pagar» y resumen): al llegar nada salta. */
export default function CargandoPedido() {
  return (
    <main
      aria-busy="true"
      aria-label="Cargando tu pedido"
      className="mx-auto w-full max-w-[1200px] px-4 pt-8 md:px-6 md:pt-12 xl:px-8"
    >
      <Esqueleto className="size-12 rounded-full" />
      <Esqueleto className="mt-4 h-7 w-56" />
      <Esqueleto className="mt-2 h-9 w-64" />
      <Esqueleto className="mt-3 h-4 w-72 max-w-full" />

      <div className="mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
        <div className="rounded-md border border-linea p-4 sm:p-6 lg:col-span-7">
          <Esqueleto className="h-6 w-32" />
          <Esqueleto className="mt-2 h-5 w-60" />
          <Esqueleto className="mt-4 h-36 w-full rounded-md" />
          <Esqueleto className="mt-5 h-14 w-full rounded-md" />
        </div>
        <div className="mt-10 border-t border-linea pt-8 lg:col-span-5 lg:mt-0 lg:rounded-md lg:border lg:p-6">
          <Esqueleto className="h-6 w-48" />
          <Esqueleto className="mt-4 h-4 w-40" />
          <Esqueleto className="mt-6 h-24 w-full" />
          <Esqueleto className="mt-6 h-8 w-full" />
        </div>
      </div>
    </main>
  );
}
