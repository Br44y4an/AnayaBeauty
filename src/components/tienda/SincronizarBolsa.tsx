"use client";

import { useEffect } from "react";
import { escucharOtrasPestanas } from "@/lib/cart";

/** La bolsa de otra pestaña (p. ej. la que abrió el enlace de WhatsApp) se refleja aquí sin pisarla. */
export function SincronizarBolsa() {
  useEffect(() => escucharOtrasPestanas(), []);
  return null;
}
