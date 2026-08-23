import { obtenerConfiguracion } from "@/lib/data/admin-catalog";
import { guardarConfiguracion } from "./actions";
import { Boton } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

const CAMPOS = [
  {
    clave: "pago_metodo",
    etiqueta: "Método de pago",
    ayuda: "Nequi, Daviplata, Bancolombia…",
  },
  {
    clave: "pago_numero",
    etiqueta: "Número o cuenta",
    ayuda: "Se le muestra a la clienta al terminar su pedido",
  },
  { clave: "pago_titular", etiqueta: "A nombre de", ayuda: "" },
  {
    clave: "whatsapp_negocio",
    etiqueta: "WhatsApp del negocio",
    ayuda: "Formato internacional sin signos: 573132553660",
  },
  {
    clave: "mensaje_exito",
    etiqueta: "Mensaje de agradecimiento",
    ayuda: "Lo primero que lee la clienta al confirmar su pedido",
  },
  {
    clave: "horas_vigencia_codigo",
    etiqueta: "Horas que dura un código",
    ayuda: "Pasado ese tiempo el código deja de servir. Por defecto 24.",
  },
];

export default async function PaginaConfiguracion() {
  const guardadas = await obtenerConfiguracion();
  const valores = Object.fromEntries(guardadas.map((f) => [f.clave, f.valor]));

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl text-carbon">Ajustes</h1>
        <p className="pt-1 text-sm text-carbon-suave">
          Estos datos aparecen en la web sin que haya que tocar el código.
        </p>
      </div>

      <form action={guardarConfiguracion} className="space-y-4">
        {CAMPOS.map((c) => (
          <label key={c.clave} className="block">
            <span className="mb-1 block text-sm font-semibold text-carbon">
              {c.etiqueta}
            </span>

            <input
              name={c.clave}
              defaultValue={valores[c.clave] ?? ""}
              className="min-h-[44px] w-full rounded-suave border-2 border-lila-suave
                         bg-petalo px-4 py-2.5 outline-none transition focus:border-fucsia"
            />

            {c.ayuda && <span className="pt-1 block text-xs text-carbon-suave">{c.ayuda}</span>}
          </label>
        ))}

        <Boton type="submit">Guardar ajustes</Boton>
      </form>
    </div>
  );
}
