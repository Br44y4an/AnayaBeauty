import { normalizarWhatsapp } from "@/lib/whatsapp";

/** Las únicas claves que el panel escribe en `store_settings`; todas las lee la tienda. */
export const CLAVES_AJUSTES = [
  "mensaje_exito",
  "umbral_por_mayor",
  "pago_metodo",
  "pago_numero",
  "pago_titular",
  "whatsapp_negocio",
  "envio_info",
] as const;

export type ClaveAjuste = (typeof CLAVES_AJUSTES)[number];

export type ResultadoAjuste = { ok: true; valor: string } | { ok: false; error: string };

/** Largo máximo de los textos libres: lo que cabe sin romper la tarjeta de pago ni el pedido. */
const LARGO_TEXTO: Record<Exclude<ClaveAjuste, "umbral_por_mayor" | "whatsapp_negocio">, number> = {
  mensaje_exito: 160,
  pago_metodo: 60,
  pago_numero: 60,
  pago_titular: 80,
  envio_info: 300,
};

// `crear_pedido` lee el umbral con `valor::int`: un «200.000» guardado así haría fallar todos los pedidos.
const MONTO_MAXIMO = 100_000_000;

/** «200.000», «$ 200.000» o «200000» → 200000; si no, el texto del error. */
function leerMonto(texto: string, ejemplo: string): number | string {
  const limpio = texto.trim().replace(/[$\s.]/g, "");
  const monto = /^\d+$/.test(limpio) ? Number(limpio) : NaN;
  if (!(monto >= 1)) return `Escribe un monto en pesos mayor que 0, por ejemplo ${ejemplo}.`;
  if (monto > MONTO_MAXIMO) return "Ese monto es demasiado alto.";
  return monto;
}

export function esClaveAjuste(clave: string): clave is ClaveAjuste {
  return (CLAVES_AJUSTES as readonly string[]).includes(clave);
}

export function validarAjuste(clave: string, valor: string): ResultadoAjuste {
  if (!esClaveAjuste(clave)) return { ok: false, error: "Ese ajuste no existe." };
  const texto = valor.trim();

  if (clave === "whatsapp_negocio") {
    const numero = normalizarWhatsapp(texto);
    return numero
      ? { ok: true, valor: numero }
      : { ok: false, error: "Escribe un celular de Colombia de 10 dígitos, por ejemplo 300 123 4567." };
  }

  if (clave === "umbral_por_mayor") {
    const monto = leerMonto(texto, "200.000");
    if (typeof monto === "string") return { ok: false, error: monto };
    return { ok: true, valor: String(monto) };
  }

  const maximo = LARGO_TEXTO[clave];
  if (texto.length > maximo) return { ok: false, error: `Es muy largo: máximo ${maximo} caracteres.` };
  return { ok: true, valor: texto };
}

export type ResultadoRegla =
  | { ok: true; montoMinimo: number; porcentaje: number }
  | { ok: false; error: string; campos: Record<string, string> };

/** Una regla de «X % desde $Y»; los mensajes van por el `name` de cada campo. */
export function validarReglaDescuento(montoTexto: string, porcentajeTexto: string): ResultadoRegla {
  const campos: Record<string, string> = {};
  const monto = leerMonto(montoTexto, "50.000");
  if (typeof monto === "string") campos.monto_minimo = monto;

  const limpio = porcentajeTexto.trim().replace(/\s*%$/, "");
  const porcentaje = /^\d{1,3}$/.test(limpio) ? Number(limpio) : NaN;
  if (!(porcentaje >= 1 && porcentaje <= 100)) campos.porcentaje = "Escribe un porcentaje entero entre 1 y 100.";

  if (typeof monto === "string" || Object.keys(campos).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", campos };
  }
  return { ok: true, montoMinimo: monto, porcentaje };
}

/** «573001234567» → «300 123 4567», como se escribe en el formulario; otro valor queda igual. */
export function celularLegible(valor: string): string {
  const celular = /^57(3\d{9})$/.exec(valor.trim())?.[1];
  return celular ? `${celular.slice(0, 3)} ${celular.slice(3, 6)} ${celular.slice(6)}` : valor;
}
