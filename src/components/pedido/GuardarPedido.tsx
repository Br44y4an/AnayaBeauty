"use client";

import { useEffect } from "react";
import { guardarPedidoEnCelular, type PedidoGuardado } from "@/lib/celular";

// Se monta solo al llegar desde «Confirmar pedido»: quien abre el enlace desde el chat (la tienda, otra
// persona) no se lleva el pedido a su «Mis pedidos» ni el aviso de «adicional» en su bolsa.
export function GuardarPedido({ id, numero, total, fecha }: PedidoGuardado) {
  useEffect(() => {
    guardarPedidoEnCelular({ id, numero, total, fecha });
    window.history.replaceState(null, "", window.location.pathname);
  }, [id, numero, total, fecha]);

  return null;
}
