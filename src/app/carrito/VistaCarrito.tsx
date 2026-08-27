"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usarCarrito } from "@/lib/cart";
import { cargarProductosDelCarrito, cargarConfiguracionPrecios } from "./actions";
import {
  calcularTotales,
  unitarioDeLinea,
  siguienteBeneficio,
  type ReglaDescuento,
} from "@/lib/discounts";
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
  const [reglas, setReglas] = useState<ReglaDescuento[]>([]);
  const [umbral, setUmbral] = useState(200000);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    Promise.all([
      cargarProductosDelCarrito(lineas.map((l) => l.productoId)),
      cargarConfiguracionPrecios(),
    ])
      .then(([p, cfg]) => {
        if (!vigente) return;
        setProductos(p);
        setReglas(cfg.reglas);
        setUmbral(cfg.umbralPorMayor);
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

  // Ajuste por stock: los tonos de un producto comparten inventario, así que
  // se reparte de a poco entre las líneas en el orden en que fueron agregadas.
  const usadoPorProducto = new Map<string, number>();

  const detalles = lineas
    .map((linea) => {
      const producto = productos.find((p) => p.id === linea.productoId);
      if (!producto || producto.escalones.length === 0) return null;

      const yaUsado = usadoPorProducto.get(producto.id) ?? 0;
      const disponible = Math.max(0, producto.stock - yaUsado);
      const cantidad = Math.min(linea.cantidad, disponible);
      if (cantidad < 1) return null;

      usadoPorProducto.set(producto.id, yaUsado + cantidad);

      return {
        linea,
        producto,
        cantidad,
        ajustado: cantidad !== linea.cantidad,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // Los tonos de un producto son líneas distintas pero comparten escalón: el
  // motor agrupa por `productoId` para decidirlo.
  const lineasCalculo = detalles.map((d) => ({
    productoId: d.producto.id,
    escalones: d.producto.escalones,
    cantidad: d.cantidad,
  }));

  const totales = calcularTotales(lineasCalculo, reglas, umbral);

  const empujon = siguienteBeneficio(totales.subtotalNormal, reglas, umbral);

  const botonCantidad =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition " +
    "duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fucsia " +
    "disabled:opacity-30";

  return (
    <div className="space-y-4">
      {detalles.map((d) => {
        // El escalón lo decide el total del producto (todos sus tonos); con
        // precio por mayor baja a su precio más bajo.
        const unitario = unitarioDeLinea(
          { productoId: d.producto.id, escalones: d.producto.escalones, cantidad: d.cantidad },
          lineasCalculo,
          totales.porMayor
        );

        const puedeSumar =
          (usadoPorProducto.get(d.producto.id) ?? 0) < d.producto.stock;

        return (
          <article
            key={`${d.producto.id}-${d.linea.tonoId ?? "sin"}`}
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

              {d.linea.tonoNombre && (
                <p className="text-xs font-semibold text-lila">
                  Tono: {d.linea.tonoNombre}
                </p>
              )}

              <p className="text-xs text-carbon-suave">{pesos(unitario)} c/u</p>

              {d.ajustado && (
                <p className="text-xs font-semibold text-fucsia">
                  Ajustamos a {d.cantidad}: es lo que queda disponible
                </p>
              )}

              <div className="mt-2 flex items-center gap-3">
                <button
                  aria-label={`Disminuir ${d.producto.nombre}`}
                  onClick={() =>
                    establecer(d.producto.id, d.linea.tonoId, d.cantidad - 1)
                  }
                  className={`${botonCantidad} border-2 border-fucsia-suave text-fucsia`}
                >
                  <IconoMenos className="h-4 w-4" />
                </button>

                <span className="w-6 text-center font-semibold text-carbon">
                  {d.cantidad}
                </span>

                <button
                  aria-label={`Aumentar ${d.producto.nombre}`}
                  disabled={!puedeSumar}
                  onClick={() =>
                    establecer(d.producto.id, d.linea.tonoId, d.cantidad + 1)
                  }
                  className={`${botonCantidad} bg-fucsia text-petalo`}
                >
                  <IconoMas className="h-4 w-4" />
                </button>

                <button
                  onClick={() => quitar(d.producto.id, d.linea.tonoId)}
                  className="ml-auto min-h-[44px] cursor-pointer px-2 text-xs
                             text-carbon-suave underline transition hover:text-fucsia"
                >
                  Quitar
                </button>
              </div>
            </div>

            <p className="shrink-0 self-center font-bold text-fucsia">
              {pesos(unitario * d.cantidad)}
            </p>
          </article>
        );
      })}

      {/* Empujón hacia el siguiente beneficio */}
      {empujon && (
        <p className="rounded-tarjeta bg-lila-suave/40 px-4 py-3 text-center text-sm text-lila">
          ✨ Te faltan <strong>{pesos(empujon.falta)}</strong> para {empujon.descripcion}
        </p>
      )}

      {/* Desglose del cobro */}
      <div className="space-y-2 rounded-tarjeta bg-petalo p-5 shadow-petalo">
        <div className="flex justify-between text-sm text-carbon-suave">
          <span>Subtotal</span>
          <span>{pesos(totales.subtotalNormal)}</span>
        </div>

        {totales.porMayor && (
          <div className="flex justify-between text-sm font-semibold text-lila">
            <span>🎉 Precio por mayor</span>
            <span>−{pesos(totales.subtotalNormal - totales.subtotalBase)}</span>
          </div>
        )}

        {totales.porcentaje > 0 && (
          <div className="flex justify-between text-sm font-semibold text-lila">
            <span>Descuento {totales.porcentaje}%</span>
            <span>−{pesos(totales.descuento)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-rosa-nube pt-3">
          <span className="font-display text-xl text-carbon">Total</span>
          <span className="font-display text-2xl text-fucsia">{pesos(totales.total)}</span>
        </div>

        {totales.ahorroTotal > 0 && (
          <p className="pt-1 text-center text-sm font-semibold text-lila">
            ✨ Estás ahorrando {pesos(totales.ahorroTotal)}
          </p>
        )}
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
