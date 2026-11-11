import Link from "next/link";
import { obtenerConfiguracion } from "@/lib/data/admin-catalog";
import { mapearConfiguracion } from "@/lib/data/configuracion";
import { celularLegible } from "@/lib/admin/ajustes";
import { FormularioAjustes, type ValoresAjustes } from "./FormularioAjustes";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracion() {
  const filas = await obtenerConfiguracion();
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor ?? "";

  const valores: ValoresAjustes = {
    pago_metodo: valor("pago_metodo"),
    pago_numero: valor("pago_numero"),
    pago_titular: valor("pago_titular"),
    whatsapp_negocio: celularLegible(valor("whatsapp_negocio")),
    mensaje_exito: valor("mensaje_exito"),
    envio_info: valor("envio_info"),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Ajustes</h1>
        <p className="text-[15px] leading-6 text-tinta-suave">
          Datos que la tienda muestra a las clientas. El precio por mayor y los descuentos están en{" "}
          <Link href="/admin/descuentos" className="font-semibold text-tinta underline underline-offset-2">
            Descuentos
          </Link>
          .
        </p>
      </header>

      <FormularioAjustes valores={valores} envioPorDefecto={mapearConfiguracion([]).envioInfo} />
    </div>
  );
}
