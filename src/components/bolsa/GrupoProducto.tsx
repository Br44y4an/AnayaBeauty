"use client";

import Image from "next/image";
import Link from "next/link";
import { IconoBolsa } from "@/components/ui/Iconos";
import { LineaVariante } from "@/components/bolsa/LineaVariante";
import { textoDeCambio } from "@/components/bolsa/AvisoCambios";
import { mostrarAviso } from "@/lib/avisos";
import { useCarrito } from "@/lib/cart";
import type { CarritoReconciliado, LineaReconciliada } from "@/lib/carrito/reconciliar";
import { unitarioDeLinea } from "@/lib/discounts";
import { pesos } from "@/lib/format";
import type { Escalon } from "@/lib/pricing";
import { rutaProducto } from "@/lib/rutas";
import type { DatosBolsa, ProductoBolsa } from "@/lib/types";
import { colorDeMuestra } from "@/lib/variantes";

/** El servidor rechaza más de 50 unidades por línea. */
const MAX_POR_LINEA = 50;

export type Grupo = {
  productoId: string;
  producto: ProductoBolsa | null;
  /** Cada línea con su posición en la bolsa guardada (para «Deshacer»). */
  lineas: { r: LineaReconciliada; indice: number }[];
  unidades: number;
  unitario: number | null;
  nota: string | null;
  subtotal: number;
};

function notaDePrecio(escalones: Escalon[], unidades: number, porMayor: boolean): string | null {
  if (porMayor) return "precio por mayor";
  const alcanzados = escalones.filter((e) => e.minCantidad <= unidades);
  const minimo = Math.max(0, ...alcanzados.map((e) => e.minCantidad));
  return minimo > 1 ? `precio de ${minimo} o más` : null;
}

/** Junta las líneas por producto en el orden de la bolsa; el escalón lo deciden todas sus variantes juntas. */
export function armarGrupos(r: CarritoReconciliado, datos: DatosBolsa, porMayor: boolean): Grupo[] {
  const porId = new Map(datos.productos.map((p) => [p.id, p]));
  const calculo = r.pedibles.map((l) => ({
    productoId: l.linea.productoId,
    escalones: porId.get(l.linea.productoId)?.escalones ?? [],
    cantidad: l.cantidad,
  }));
  const grupos = new Map<string, Grupo>();

  r.lineas.forEach((l, indice) => {
    const id = l.linea.productoId;
    const grupo = grupos.get(id) ?? {
      productoId: id,
      producto: porId.get(id) ?? null,
      lineas: [],
      unidades: 0,
      unitario: null,
      nota: null,
      subtotal: 0,
    };
    grupo.lineas.push({ r: l, indice });
    grupo.unidades += l.cantidad;
    grupos.set(id, grupo);
  });

  for (const g of grupos.values()) {
    const escalones = g.producto?.escalones ?? [];
    if (g.unidades < 1 || escalones.length === 0) continue;
    g.unitario = unitarioDeLinea({ productoId: g.productoId, escalones, cantidad: g.unidades }, calculo, porMayor);
    g.subtotal = g.unitario * g.unidades;
    g.nota = notaDePrecio(escalones, g.unidades, porMayor);
  }
  return [...grupos.values()];
}

function quitar({ r, indice }: Grupo["lineas"][number], producto: ProductoBolsa | null) {
  const { original } = r;
  useCarrito.getState().quitar(original.productoId, original.tonoId);
  mostrarAviso({
    titulo: `Quitaste ${r.linea.tonoNombre ?? producto?.nombre ?? "el producto"}`,
    detalle: r.linea.tonoNombre ? producto?.nombre : undefined,
    imagen: producto?.imagenPrincipal,
    accion: { etiqueta: "Deshacer", alHacer: () => useCarrito.getState().restaurar(original, indice) },
  });
}

export function GrupoProducto({ grupo }: { grupo: Grupo }) {
  const { producto, unitario } = grupo;
  const nombre = producto?.nombre ?? "Producto no disponible";

  return (
    <li className="border-b border-linea py-5 first:pt-2">
      <div className="flex gap-3">
        <Miniatura producto={producto} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            {producto ? (
              <Link
                href={rutaProducto(producto.referencia)}
                className="text-[15px] font-medium leading-5 text-tinta underline-offset-2 hover:underline"
              >
                {nombre}
              </Link>
            ) : (
              <p className="text-[15px] font-medium leading-5 text-tinta-suave">{nombre}</p>
            )}
            {unitario !== null && (
              <p className="shrink-0 text-[15px] font-semibold leading-5 tabular-nums text-tinta">
                {pesos(grupo.subtotal)}
              </p>
            )}
          </div>
          {producto && (
            <p className="mt-1 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
              Ref. {producto.referencia}
            </p>
          )}
          {unitario !== null && (
            <p className="mt-1 text-[13px] leading-[18px] tabular-nums text-tinta-suave">
              {pesos(unitario)} c/u{grupo.nota && ` · ${grupo.nota}`}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-2" aria-label={`Variantes de ${nombre}`}>
        {grupo.lineas.map((linea) => {
          const { r } = linea;
          const etiqueta = r.linea.tonoNombre ? `${nombre}, ${r.linea.tonoNombre}` : nombre;
          const variante = producto?.variantes.find((v) => v.id === r.linea.tonoId);
          const max = Math.min(MAX_POR_LINEA, (producto?.stock ?? 0) - (grupo.unidades - r.cantidad));
          return (
            <LineaVariante
              key={`${r.original.productoId}-${r.original.tonoId ?? "sin"}`}
              nombre={r.linea.tonoNombre}
              colorHex={variante ? colorDeMuestra(variante) : null}
              cantidad={r.cantidad}
              max={max}
              etiqueta={etiqueta}
              aviso={textoDeCambio(r, producto)}
              alCambiar={(n) =>
                n < 1
                  ? quitar(linea, producto)
                  : useCarrito.getState().establecer(r.original.productoId, r.original.tonoId, n)
              }
              alQuitar={() => quitar(linea, producto)}
            />
          );
        })}
      </ul>
    </li>
  );
}

function Miniatura({ producto }: { producto: ProductoBolsa | null }) {
  const contenido = producto?.imagenPrincipal ? (
    <Image
      src={producto.imagenPrincipal}
      alt=""
      width={64}
      height={64}
      sizes="64px"
      className="size-full object-contain mix-blend-multiply"
    />
  ) : (
    <IconoBolsa tamano={24} className="text-tinta-suave" />
  );
  const clases = "flex size-16 shrink-0 items-center justify-center rounded-sm bg-superficie p-1";

  // Mismo destino que el nombre: tocar la foto ayuda, pero el lector solo oye un enlace.
  return producto ? (
    <Link href={rutaProducto(producto.referencia)} tabIndex={-1} aria-hidden="true" className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
