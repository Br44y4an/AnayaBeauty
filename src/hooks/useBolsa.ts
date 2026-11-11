"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useCarrito } from "@/lib/cart";
import { reconciliarCarrito, type CarritoReconciliado } from "@/lib/carrito/reconciliar";
import { calcularTotales, type Totales } from "@/lib/discounts";
import type { DatosBolsa } from "@/lib/types";

export type EstadoBolsa = "hidratando" | "cargando" | "listo" | "error";

type Carga = { ids: ReadonlySet<string>; datos: DatosBolsa; intento: number };

const BOLSA_VACIA = reconciliarCarrito([], []);

// El servidor no ve el localStorage: hasta hidratar, la bolsa «no se sabe» (y no se pide nada).
// Sin almacenamiento (cookies bloqueadas) zustand no crea `persist` y la bolsa vive en memoria.
const alHidratar = (avisar: () => void) => useCarrito.persist?.onFinishHydration(avisar) ?? (() => {});
const estaHidratada = () => useCarrito.persist?.hasHydrated() ?? true;
const enServidor = () => false;

/** Datos frescos de la bolsa (`GET /api/bolsa`), reconciliados con lo guardado y con sus totales. */
export function useBolsa(): {
  estado: EstadoBolsa;
  datos: DatosBolsa | null;
  reconciliado: CarritoReconciliado | null;
  totales: Totales | null;
  reintentar: () => void;
} {
  const hidratada = useSyncExternalStore(alHidratar, estaHidratada, enServidor);
  const lineas = useCarrito((e) => e.lineas);
  const clave = useMemo(() => [...new Set(lineas.map((l) => l.productoId))].sort().join(","), [lineas]);

  const [carga, setCarga] = useState<Carga | null>(null);
  const [fallo, setFallo] = useState<{ clave: string; intento: number } | null>(null);
  const [intento, setIntento] = useState(0);

  // Quitar, deshacer o cambiar cantidades no vuelve a pedir: basta con que lo cargado cubra la bolsa.
  const cubre = carga !== null && clave.split(",").every((id) => carga.ids.has(id));
  const pedir = hidratada && clave !== "" && !(cubre && carga.intento === intento);

  useEffect(() => {
    if (!pedir) return;
    const control = new AbortController();
    fetch(`/api/bolsa?ids=${clave}`, { cache: "no-store", signal: control.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const datos = (await r.json()) as DatosBolsa;
        setCarga({ ids: new Set(clave.split(",")), datos, intento });
      })
      .catch(() => {
        if (!control.signal.aborted) setFallo({ clave, intento });
      });
    return () => control.abort();
  }, [pedir, clave, intento]);

  const datos = cubre ? carga.datos : null;
  const calculo = useMemo(() => (datos ? calcular(lineas, datos) : null), [lineas, datos]);

  let estado: EstadoBolsa = "listo";
  if (!hidratada) estado = "hidratando";
  else if (clave !== "" && !cubre) {
    estado = fallo?.clave === clave && fallo.intento === intento ? "error" : "cargando";
  }

  return {
    estado,
    datos,
    reconciliado: !hidratada ? null : clave === "" ? BOLSA_VACIA : (calculo?.reconciliado ?? null),
    totales: calculo?.totales ?? null,
    reintentar: () => setIntento((n) => n + 1),
  };
}

function calcular(lineas: Parameters<typeof reconciliarCarrito>[0], datos: DatosBolsa) {
  const porId = new Map(datos.productos.map((p) => [p.id, p]));
  // Sin precio no se puede cobrar: para la clienta es lo mismo que si no estuviera.
  const reconciliado = reconciliarCarrito(
    lineas,
    datos.productos.map((p) => ({
      id: p.id,
      stock: p.stock,
      activo: p.activo && p.escalones.length > 0,
      variantes: p.variantes,
    }))
  );
  const totales = calcularTotales(
    reconciliado.pedibles.map((l) => ({
      productoId: l.linea.productoId,
      escalones: porId.get(l.linea.productoId)?.escalones ?? [],
      cantidad: l.cantidad,
    })),
    datos.reglas,
    datos.umbralPorMayor
  );
  return { reconciliado, totales };
}
