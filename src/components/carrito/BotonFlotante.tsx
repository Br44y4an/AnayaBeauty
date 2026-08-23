"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usarCarrito, totalUnidades } from "@/lib/cart";
import { IconoBolsa } from "@/components/ui/Iconos";

const RUTAS_SIN_BOTON = ["/carrito", "/confirmar"];

export function BotonFlotante() {
  const [montado, setMontado] = useState(false);
  const ruta = usePathname();
  const lineas = usarCarrito((e) => e.lineas);
  const unidades = totalUnidades({ lineas });

  // localStorage no existe durante el renderizado en el servidor:
  // esperar al montaje evita el desajuste de hidratación.
  useEffect(() => setMontado(true), []);

  if (!montado || unidades === 0) return null;
  if (RUTAS_SIN_BOTON.some((r) => ruta.startsWith(r))) return null;
  if (ruta.startsWith("/admin") || ruta.startsWith("/pedido")) return null;

  return (
    <Link
      href="/carrito"
      aria-label={`Ver mi pedido, ${unidades} ${unidades === 1 ? "producto" : "productos"}`}
      className="fixed bottom-5 left-1/2 z-50 flex min-h-[52px] -translate-x-1/2
                 cursor-pointer items-center gap-3 rounded-pastilla bg-fucsia px-7
                 font-semibold text-petalo shadow-flotante transition duration-200
                 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-fucsia focus-visible:ring-offset-2"
    >
      <IconoBolsa />
      <span>Ver mi pedido</span>
      <span
        key={unidades}
        className="flex h-7 min-w-7 animate-[rebote_0.4s_ease] items-center justify-center
                   rounded-full bg-petalo px-2 text-sm font-bold text-fucsia"
      >
        {unidades}
      </span>
    </Link>
  );
}
