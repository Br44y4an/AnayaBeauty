import { listarReglasDescuento, obtenerConfiguracion } from "@/lib/data/admin-catalog";
import {
  guardarReglaDescuento,
  alternarReglaDescuento,
  eliminarReglaDescuento,
  guardarUmbralPorMayor,
} from "../productos/actions";
import { pesos } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

const CAMPO =
  "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-2.5 " +
  "outline-none transition focus:border-fucsia";

export default async function PaginaDescuentos() {
  const [reglas, config] = await Promise.all([
    listarReglasDescuento(),
    obtenerConfiguracion(),
  ]);

  const umbral = Number(
    config.find((c) => c.clave === "umbral_por_mayor")?.valor ?? 200000
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-carbon">Descuentos</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Dos beneficios que se aplican solos, uno después del otro.
        </p>
      </div>

      {/* Cómo se calcula */}
      <div className="space-y-2 rounded-tarjeta bg-lila-suave/30 p-5">
        <p className="text-sm font-semibold text-carbon">Cómo se calcula un pedido</p>
        <ol className="space-y-1 text-sm text-carbon-suave">
          <li>1. Se suman los productos con su precio según la cantidad.</li>
          <li>
            2. Si el total llega a <strong>{pesos(umbral)}</strong>, todos los
            productos pasan a su precio más barato.
          </li>
          <li>3. Sobre ese resultado se aplica el porcentaje que corresponda.</li>
        </ol>
        <p className="pt-1 text-xs text-carbon-suave">
          El umbral se mide antes de rebajar. Una vez aplicado el precio por mayor
          no se quita, aunque el total quede por debajo.
        </p>
      </div>

      {/* Umbral del por mayor */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-carbon">Precio por mayor</h2>

        <form
          action={guardarUmbralPorMayor}
          className="flex flex-wrap items-end gap-3 rounded-tarjeta bg-petalo p-5 shadow-petalo"
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm font-semibold text-carbon">
              A partir de cuánto se activa
            </span>
            <input
              name="umbral_por_mayor"
              type="number"
              min={1000}
              step={1000}
              defaultValue={umbral}
              className={CAMPO}
            />
          </label>

          <Boton type="submit">Guardar</Boton>
        </form>
      </section>

      {/* Reglas de porcentaje */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-carbon">Descuento por porcentaje</h2>
        <p className="text-sm text-carbon-suave">
          Si una clienta alcanza varias reglas, se le aplica la de mayor monto.
        </p>

        <form
          action={guardarReglaDescuento}
          className="flex flex-wrap items-end gap-3 rounded-tarjeta bg-petalo p-5 shadow-petalo"
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm font-semibold text-carbon">
              Desde (pesos)
            </span>
            <input
              name="monto_minimo"
              type="number"
              min={1000}
              step={1000}
              required
              placeholder="50000"
              className={CAMPO}
            />
          </label>

          <label className="w-32">
            <span className="mb-1 block text-sm font-semibold text-carbon">
              Descuento %
            </span>
            <input
              name="porcentaje"
              type="number"
              min={1}
              max={100}
              required
              placeholder="5"
              className={CAMPO}
            />
          </label>

          <Boton type="submit">Agregar</Boton>
        </form>

        {reglas.length === 0 ? (
          <p className="py-8 text-center text-carbon-suave">
            No hay reglas de descuento. Agrega la primera arriba.
          </p>
        ) : (
          <ul className="space-y-2">
            {reglas.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 rounded-tarjeta bg-petalo
                            p-4 shadow-petalo ${r.activo ? "" : "opacity-50"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-carbon">
                    Desde <strong>{pesos(r.montoMinimo)}</strong> →{" "}
                    <strong className="text-fucsia">{r.porcentaje}% de descuento</strong>
                  </p>
                  <p className="text-xs text-carbon-suave">
                    {r.activo ? "Activa" : "Desactivada"} · un pedido de{" "}
                    {pesos(r.montoMinimo)} pagaría{" "}
                    {pesos(r.montoMinimo - Math.round((r.montoMinimo * r.porcentaje) / 100))}
                  </p>
                </div>

                <form action={alternarReglaDescuento.bind(null, r.id, !r.activo)}>
                  <button className="min-h-[40px] cursor-pointer px-2 text-xs
                                     text-carbon-suave underline transition hover:text-fucsia">
                    {r.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>

                <form action={eliminarReglaDescuento.bind(null, r.id)}>
                  <button className="min-h-[40px] cursor-pointer px-2 text-xs
                                     text-carbon-suave underline transition hover:text-fucsia">
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
