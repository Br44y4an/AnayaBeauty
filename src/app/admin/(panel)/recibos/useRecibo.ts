"use client";

import { useEffect, useMemo, useReducer } from "react";
import { guardarPreferencias, leerPreferencias } from "@/lib/admin/recibo";
import { armarRecibo, type ContextoRecibo } from "./armarRecibo";
import { estadoInicial, reducirRecibo } from "./estadoRecibo";

/** Un solo reductor para todo el constructor; las preferencias se leen al montar y se guardan al cambiar. */
export function useRecibo(
  inicio: { pedidoId: string; hoy: string; numero: string },
  contexto: ContextoRecibo
) {
  const [estado, despachar] = useReducer(reducirRecibo, inicio, estadoInicial);

  // El servidor no ve el localStorage: se lee después de hidratar para no desfasar el HTML.
  useEffect(() => {
    despachar({ tipo: "cargarPreferencias", preferencias: leerPreferencias() });
  }, []);

  useEffect(() => {
    if (estado.preferenciasCargadas) guardarPreferencias(estado.preferencias);
  }, [estado.preferenciasCargadas, estado.preferencias]);

  const { pedidos, productos, reglas, umbralPorMayor, pago } = contexto;
  const recibo = useMemo(
    () => armarRecibo(estado, { pedidos, productos, reglas, umbralPorMayor, pago }),
    [estado, pedidos, productos, reglas, umbralPorMayor, pago]
  );

  return { estado, despachar, recibo };
}
