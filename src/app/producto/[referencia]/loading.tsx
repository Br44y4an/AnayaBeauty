import { Esqueleto } from "@/components/ui/Esqueleto";

export default function CargandoProducto() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-32">
      <Esqueleto className="my-4 h-5 w-32" />
      <Esqueleto className="aspect-square w-full rounded-tarjeta" />
      <div className="space-y-3 py-5">
        <Esqueleto className="h-4 w-24" />
        <Esqueleto className="h-8 w-3/4" />
        <Esqueleto className="h-4 w-full" />
      </div>
      <Esqueleto className="h-40 w-full rounded-tarjeta" />
    </main>
  );
}
