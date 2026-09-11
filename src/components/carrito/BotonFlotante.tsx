"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usarTotalUnidades } from "@/lib/cart";
import { IconoBolsa } from "@/components/ui/Iconos";

/** Donde el botón estorbaría en vez de ayudar. */
const RUTAS_SIN_BOTON = ["/carrito", "/confirmar", "/admin", "/pedido"];

/**
 * Acceso permanente a la bolsa.
 *
 * Se suscribe solo al TOTAL de unidades (un número), no a la lista de
 * líneas: así no se vuelve a renderizar cada vez que cambia cualquier
 * detalle interno del carrito.
 */
export function BotonFlotante() {
  const [montado, setMontado] = useState(false);
  const ruta = usePathname();
  const unidades = usarTotalUnidades();

  // localStorage no existe durante el renderizado en el servidor:
  // esperar al montaje evita el desajuste de hidratación.
  useEffect(() => setMontado(true), []);

  if (!montado || unidades === 0) return null;
  if (RUTAS_SIN_BOTON.some((r) => ruta.startsWith(r))) return null;

  return (
    <div className="margen-seguro pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <Link
        href="/carrito"
        aria-label={`Ver mi pedido, ${unidades} ${unidades === 1 ? "producto" : "productos"}`}
        className="pointer-events-auto flex min-h-[56px] cursor-pointer items-center gap-3
                   rounded-pastilla bg-fucsia px-7 text-lg font-semibold text-petalo
                   shadow-flotante transition duration-200 hover:brightness-110"
      >
        <IconoBolsa className="h-6 w-6" />
        <span>Ver mi pedido</span>
        <span
          key={unidades}
          className="flex h-7 min-w-7 animate-[rebote_0.4s_ease] items-center justify-center
                     rounded-full bg-petalo px-2 text-base font-bold text-fucsia-texto"
        >
          {unidades}
        </span>
      </Link>
    </div>
  );
}
