"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usarCarrito } from "@/lib/cart";
import { cargarProductosDelCarrito } from "./actions";
import { subtotalPara, precioUnitarioPara } from "@/lib/pricing";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import {
  IconoMas,
  IconoMenos,
  IconoCorazon,
  IconoWhatsApp,
} from "@/components/ui/Iconos";
import type { Producto } from "@/lib/types";

export function VistaCarrito() {
  const { lineas, establecer, quitar } = usarCarrito();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    cargarProductosDelCarrito(lineas.map((l) => l.productoId))
      .then((p) => {
        if (vigente) setProductos(p);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas.length]);

  if (cargando) {
    return <p className="py-20 text-center text-carbon-suave">Cargando tu pedido…</p>;
  }

  if (lineas.length === 0) {
    return (
      <div className="space-y-5 py-16 text-center">
        <p className="flex justify-center text-lila-suave">
          <IconoCorazon className="h-14 w-14" />
        </p>
        <p className="font-display text-2xl text-carbon">Tu bolsa está vacía</p>
        <p className="text-sm text-carbon-suave">Vuelve al catálogo y consiéntete ♡</p>
        <Link href="/" className="inline-block">
          <Boton>Ver el catálogo</Boton>
        </Link>
      </div>
    );
  }

  const detalles = lineas
    .map((linea) => {
      const producto = productos.find((p) => p.id === linea.productoId);
      if (!producto || producto.escalones.length === 0) return null;

      // Si el stock bajó mientras la clienta armaba su pedido,
      // se ajusta y se le avisa en vez de fallar al confirmar.
      const cantidad = Math.min(linea.cantidad, producto.stock);
      if (cantidad < 1) return null;

      return {
        producto,
        cantidad,
        subtotal: subtotalPara(producto.escalones, cantidad),
        precioUnitario: precioUnitarioPara(producto.escalones, cantidad),
        ajustado: cantidad !== linea.cantidad,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const total = detalles.reduce((suma, d) => suma + d.subtotal, 0);

  // Cuánto se ahorró frente a pagar todo al precio de una sola unidad
  const ahorro = detalles.reduce((suma, d) => {
    const masCaro = Math.max(...d.producto.escalones.map((e) => e.precioUnitario));
    return suma + (masCaro - d.precioUnitario) * d.cantidad;
  }, 0);

  const botonCantidad =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition duration-200 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia disabled:opacity-30";

  return (
    <div className="space-y-4">
      {detalles.map((d) => (
        <article
          key={d.producto.id}
          className="flex gap-3 rounded-tarjeta bg-petalo p-3 shadow-petalo"
        >
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
            {d.producto.imagenPrincipal ? (
              <Image
                src={d.producto.imagenPrincipal}
                alt={d.producto.nombre}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-lila-suave">
                <IconoCorazon className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-lila">{d.producto.referencia}</p>
            <h3 className="truncate text-sm font-semibold text-carbon">
              {d.producto.nombre}
            </h3>
            <p className="text-xs text-carbon-suave">{pesos(d.precioUnitario)} c/u</p>

            {d.ajustado && (
              <p className="text-xs font-semibold text-fucsia">
                Ajustamos a {d.cantidad}: es lo que queda disponible
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                aria-label={`Disminuir ${d.producto.nombre}`}
                onClick={() => establecer(d.producto.id, d.cantidad - 1)}
                className={`${botonCantidad} border-2 border-fucsia-suave text-fucsia`}
              >
                <IconoMenos className="h-4 w-4" />
              </button>

              <span className="w-6 text-center font-semibold text-carbon">
                {d.cantidad}
              </span>

              <button
                aria-label={`Aumentar ${d.producto.nombre}`}
                disabled={d.cantidad >= d.producto.stock}
                onClick={() => establecer(d.producto.id, d.cantidad + 1)}
                className={`${botonCantidad} bg-fucsia text-petalo`}
              >
                <IconoMas className="h-4 w-4" />
              </button>

              <button
                onClick={() => quitar(d.producto.id)}
                className="ml-auto min-h-[44px] cursor-pointer px-2 text-xs
                           text-carbon-suave underline transition hover:text-fucsia"
              >
                Quitar
              </button>
            </div>
          </div>

          <p className="shrink-0 self-center font-bold text-fucsia">{pesos(d.subtotal)}</p>
        </article>
      ))}

      <div className="space-y-2 rounded-tarjeta bg-petalo p-5 shadow-petalo">
        {ahorro > 0 && (
          <p className="text-center text-sm font-semibold text-lila">
            ✨ Estás ahorrando {pesos(ahorro)} con tus combos
          </p>
        )}
        <div className="flex items-center justify-between border-t border-rosa-nube pt-3">
          <span className="font-display text-xl text-carbon">Total</span>
          <span className="font-display text-2xl text-fucsia">{pesos(total)}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-tarjeta bg-lila-suave/30 p-5 text-center">
        <p className="text-sm leading-relaxed text-carbon">
          Para confirmar tu pedido necesitas tu <strong>código de 4 dígitos</strong>.
          Escríbenos y te lo enviamos apenas confirmemos tu pago 💕
        </p>
        <a
          href={enlaceWhatsApp("¡Hola! Quiero mi código para hacer mi pedido 💕")}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Boton variante="secundario" ancho>
            <IconoWhatsApp /> Pedir mi código por WhatsApp
          </Boton>
        </a>
      </div>

      <Link href="/confirmar" className="block">
        <Boton ancho>Ya tengo mi código · Confirmar</Boton>
      </Link>
    </div>
  );
}
