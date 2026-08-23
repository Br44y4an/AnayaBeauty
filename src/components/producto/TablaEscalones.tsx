import { pesos } from "@/lib/format";
import type { Escalon } from "@/lib/pricing";

export function TablaEscalones({
  escalones,
  cantidadActual,
}: {
  escalones: Escalon[];
  cantidadActual: number;
}) {
  const ordenados = [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);

  const aplicable = ordenados.reduce(
    (mejor, e) => (e.minCantidad <= cantidadActual ? e : mejor),
    ordenados[0]
  );

  return (
    <ul className="space-y-1 rounded-tarjeta bg-petalo p-4 shadow-petalo">
      {ordenados.map((e) => {
        const activo = e.minCantidad === aplicable?.minCantidad;
        return (
          <li
            key={e.minCantidad}
            className={`flex items-center justify-between rounded-suave px-3 py-2 text-sm transition duration-200
              ${activo ? "bg-fucsia/10 font-bold text-fucsia" : "text-carbon-suave"}`}
          >
            <span>
              {e.minCantidad === 1 ? "1 unidad" : `${e.minCantidad} unidades o más`}
            </span>
            <span>{pesos(e.precioUnitario)} c/u</span>
          </li>
        );
      })}
    </ul>
  );
}
