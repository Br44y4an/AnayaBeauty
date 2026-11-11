"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { confirmarPedido, type ResultadoConfirmacion } from "@/app/(tienda)/carrito/actions";
import { useCarrito } from "@/lib/cart";
import { guardarDatosCliente, olvidarDatosCliente } from "@/lib/celular";

export type FalloConfirmacion = Extract<ResultadoConfirmacion, { ok: false }>;

// Sin respuesta (red caída, o un despliegue nuevo que ya no conoce esta acción) la bolsa sigue intacta.
const SIN_RESPUESTA: FalloConfirmacion = {
  ok: false,
  mensaje:
    "No pudimos conectar con la tienda. Revisa tu conexión, recarga la página e intenta de nuevo. Tu bolsa sigue guardada.",
};

/** Desmarcar «Recordar» también es una decisión: olvida lo que este celular tenía guardado. */
function recordarDatos(datos: FormData) {
  const valor = (clave: string) => String(datos.get(clave) ?? "").trim();
  if (datos.get("recordar") === "si") {
    guardarDatosCliente({ nombre: valor("nombre"), whatsapp: valor("whatsapp"), ciudad: valor("ciudad") });
  } else {
    olvidarDatosCliente();
  }
}

/** Envía el pedido con la clave del intento; si sale bien recuerda (o no) los datos, vacía la bolsa y abre el pedido. */
export function useConfirmarPedido(opciones: { alFallar?: (fallo: FalloConfirmacion) => void } = {}): {
  resultado: ResultadoConfirmacion | null;
  enviando: boolean;
  accion: (datos: FormData) => void;
} {
  const router = useRouter();

  const [resultado, accion, enviando] = useActionState(
    async (previo: ResultadoConfirmacion | null, datos: FormData): Promise<ResultadoConfirmacion> => {
      datos.set("clave", useCarrito.getState().prepararEnvio());

      let r: ResultadoConfirmacion;
      try {
        r = await confirmarPedido(previo, datos);
      } catch (error) {
        console.error("[pedido] la confirmación no obtuvo respuesta:", error);
        r = SIN_RESPUESTA;
      }

      if (!r.ok) {
        opciones.alFallar?.(r);
        return r;
      }
      recordarDatos(datos);
      // «nuevo» le dice a la página que este celular hizo el pedido (lo guarda en «Mis pedidos»).
      router.push(`/pedido/${encodeURIComponent(r.id)}?nuevo=1`);
      useCarrito.getState().vaciar();
      return r;
    },
    null
  );

  return { resultado, enviando, accion };
}
