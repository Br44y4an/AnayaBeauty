import { EsqueletoGrilla, Esqueleto } from "@/components/ui/Esqueleto";

export default function CargandoCatalogo() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-32">
      <Esqueleto className="mt-4 aspect-[1600/670] w-full rounded-tarjeta" />
      <div className="space-y-3 py-4">
        <Esqueleto className="h-[52px] w-full rounded-pastilla" />
        <div className="flex gap-2">
          <Esqueleto className="h-11 w-20 rounded-pastilla" />
          <Esqueleto className="h-11 w-28 rounded-pastilla" />
          <Esqueleto className="h-11 w-24 rounded-pastilla" />
        </div>
      </div>
      <EsqueletoGrilla />
    </main>
  );
}
