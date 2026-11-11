import type { ReactNode } from "react";
import { IconoCheck } from "@/components/ui/Iconos";
import { pesos } from "@/lib/format";
import type { LineaPedido, Pedido } from "@/lib/types";

type Grupo = { clave: string; nombre: string; referencia: string; lineas: LineaPedido[] };

/** Las variantes de un producto van juntas, como en la bolsa: el precio por cantidad es del producto. */
function agrupar(lineas: LineaPedido[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const l of lineas) {
    const clave = `${l.referencia}\u0000${l.nombre}`;
    const grupo = grupos.get(clave) ?? { clave, nombre: l.nombre, referencia: l.referencia, lineas: [] };
    grupo.lineas.push(l);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

function detalleDePrecio(lineas: LineaPedido[]): string {
  const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const texto = unidades === 1 ? "1 unidad" : `${unidades} unidades`;
  const precios = new Set(lineas.map((l) => l.precioUnitarioAplicado));
  return precios.size === 1 ? `${texto} · ${pesos(lineas[0].precioUnitarioAplicado)} c/u` : texto;
}

function Fila({ etiqueta, valor, className = "text-tinta-suave" }: { etiqueta: ReactNode; valor?: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${className}`}>
      <span className="flex items-center gap-1.5">{etiqueta}</span>
      {valor && <span className="tabular-nums">{valor}</span>}
    </div>
  );
}

export function ResumenPedido({ pedido }: { pedido: Pedido }) {
  const conBeneficio = pedido.porMayor || pedido.porcentajeDescuento > 0;

  return (
    <section aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen" className="text-xl font-semibold leading-[26px] text-tinta">
        Resumen del pedido
      </h2>

      <div className="mt-3 text-[15px] leading-5">
        <p className="text-[13px] leading-[18px] text-tinta-suave">A nombre de</p>
        <p className="mt-0.5 font-semibold text-tinta">{pedido.clienteNombre}</p>
        <p className="mt-1 text-tinta-suave">
          {pedido.clienteCiudad} · WhatsApp {pedido.clienteWhatsapp}
        </p>
        {pedido.notasCliente && <p className="mt-2 break-words text-tinta-suave">Nota: {pedido.notasCliente}</p>}
      </div>

      <ul aria-label="Productos del pedido" className="mt-4 divide-y divide-linea border-y border-linea">
        {agrupar(pedido.lineas).map((g) => {
          const conVariantes = g.lineas.some((l) => l.tono);
          return (
            <li key={g.clave} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[15px] font-medium leading-5 text-tinta">{g.nombre}</p>
                <p className="shrink-0 text-[15px] font-semibold leading-5 tabular-nums text-tinta">
                  {pesos(g.lineas.reduce((suma, l) => suma + l.subtotal, 0))}
                </p>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                Ref. {g.referencia}
              </p>
              <p className="mt-1 text-[13px] leading-[18px] tabular-nums text-tinta-suave">{detalleDePrecio(g.lineas)}</p>
              {conVariantes && (
                <ul aria-label={`Variantes de ${g.nombre}`} className="mt-2 space-y-1.5">
                  {g.lineas.map((l) => (
                    <li key={l.id} className="flex justify-between gap-4 text-[15px] leading-5 text-tinta">
                      <span className="min-w-0">{l.tono ?? "Sin variante"}</span>
                      <span className="tabular-nums text-tinta-suave">× {l.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-2 text-[15px] leading-5">
        {conBeneficio && <Fila etiqueta="Subtotal" valor={pesos(pedido.subtotal)} />}
        {pedido.porMayor && (
          <Fila
            className="text-ahorro"
            etiqueta={
              <>
                <IconoCheck tamano={18} className="shrink-0" />
                Precio por mayor aplicado
              </>
            }
          />
        )}
        {pedido.porcentajeDescuento > 0 && (
          <Fila
            className="text-ahorro"
            etiqueta={`Descuento (${pedido.porcentajeDescuento} %)`}
            valor={`−${pesos(pedido.descuento)}`}
          />
        )}
        <div className="flex items-baseline justify-between gap-4 border-t border-linea pt-3">
          <span className="font-semibold text-tinta">Total productos</span>
          <span className="text-2xl font-bold leading-[30px] tabular-nums text-tinta">{pesos(pedido.total)}</span>
        </div>
      </div>
    </section>
  );
}
