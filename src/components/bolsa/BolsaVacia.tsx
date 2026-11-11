import { BotonEnlace } from "@/components/ui/Boton";
import { IconoBolsa } from "@/components/ui/Iconos";
import { PedidosRecientes } from "@/components/bolsa/PedidosRecientes";

export function BolsaVacia() {
  return (
    <div className="mx-auto max-w-md pb-8 pt-6 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-superficie text-tinta-suave">
        <IconoBolsa tamano={28} />
      </span>
      <h2 className="mt-5 text-xl font-semibold leading-[26px] text-tinta">Tu bolsa está vacía</h2>
      <p className="mt-2 text-base text-tinta-suave">Agrega productos desde el catálogo.</p>
      <BotonEnlace href="/" className="mt-6 min-w-56">
        Ver el catálogo
      </BotonEnlace>
      <div className="mt-12">
        <PedidosRecientes />
      </div>
    </div>
  );
}
