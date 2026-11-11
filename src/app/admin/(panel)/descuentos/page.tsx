import { listarReglasDescuento, obtenerConfiguracion } from "@/lib/data/admin-catalog";
import { mapearConfiguracion } from "@/lib/data/configuracion";
import { pesos } from "@/lib/format";
import { FormularioUmbral } from "./FormularioUmbral";
import { ReglasDescuento } from "./ReglasDescuento";

export const dynamic = "force-dynamic";

const TITULO = "text-xl font-semibold leading-[26px] text-tinta";

export default async function PaginaDescuentos() {
  const [reglas, ajustes] = await Promise.all([listarReglasDescuento(), obtenerConfiguracion()]);
  // La misma lectura que hace la tienda: un umbral vacío o inválido usa el de por defecto.
  const { umbralPorMayor } = mapearConfiguracion(ajustes);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Descuentos</h1>
        <p className="text-[15px] leading-6 text-tinta-suave">
          Se aplican solos en la bolsa y en el pedido, en este orden:
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-6 text-tinta">
          <li>Cada producto se cobra con su precio por cantidad.</li>
          <li>
            Si la suma llega a {pesos(umbralPorMayor)}, todos los productos pasan a su precio más bajo (precio por
            mayor).
          </li>
          <li>Sobre ese total se resta el descuento por monto más alto que alcance.</li>
        </ol>
      </header>

      <section aria-labelledby="mayor-titulo" className="space-y-4 border-t border-linea pt-6">
        <div>
          <h2 id="mayor-titulo" className={TITULO}>
            Precio por mayor
          </h2>
          <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
            Se mide con los precios normales y, una vez aplicado, no se quita aunque el total quede por debajo.
          </p>
        </div>
        <FormularioUmbral umbral={umbralPorMayor} />
      </section>

      <section aria-labelledby="monto-titulo" className="space-y-4 border-t border-linea pt-6">
        <div>
          <h2 id="monto-titulo" className={TITULO}>
            Descuento por monto
          </h2>
          <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
            Si la bolsa alcanza varios, se aplica el de mayor monto. La tienda los anuncia en la franja de beneficios.
          </p>
        </div>
        <ReglasDescuento reglas={reglas} />
      </section>
    </div>
  );
}
