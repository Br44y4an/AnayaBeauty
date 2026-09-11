"use client";

import { useState } from "react";
import { TarjetaProducto } from "./TarjetaProducto";
import { Boton } from "@/components/ui/Boton";
import { EsqueletoTarjeta } from "@/components/ui/Esqueleto";
import { IconoFlechaAbajo, IconoBuscar } from "@/components/ui/Iconos";
import { cargarMasProductos } from "@/app/acciones-catalogo";
import type { OrdenCatalogo } from "@/lib/data/catalog";
import type { Producto } from "@/lib/types";

/**
 * La grilla del catálogo, por tandas.
 *
 * Antes se pintaban TODOS los productos activos de una sola vez: con 591
 * en la tienda eso eran 591 componentes de React, 591 imágenes y 591
 * suscripciones al carrito en la misma pantalla. El celular no daba
 * abasto y el catálogo "se trababa" antes incluso de tocar nada.
 *
 * Ahora llegan de 24 en 24. La primera tanda viene renderizada desde el
 * servidor (aparece al instante, buena para Google); las siguientes las
 * pide este componente y las añade al final, sin navegar, para no perder
 * el scroll ni el sitio en la lista.
 *
 * El botón es explícito y no scroll infinito: con scroll infinito nunca
 * se llega al pie y la clienta no sabe cuánto falta. El contador
 * ("24 de 591") le dice exactamente dónde está.
 */
export function ListaProductos({
  inicial,
  total,
  hayMasInicial,
  filtros,
}: {
  inicial: Producto[];
  total: number;
  hayMasInicial: boolean;
  filtros: { busqueda?: string; categoriaSlug?: string; orden?: OrdenCatalogo };
}) {
  const [productos, setProductos] = useState(inicial);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function verMas() {
    setCargando(true);
    setFallo(null);

    try {
      const siguiente = pagina + 1;
      const resultado = await cargarMasProductos({ ...filtros, pagina: siguiente });

      setProductos((previos) => {
        // Cinturón y tirantes: si dos toques rápidos piden la misma
        // página, no se duplica ningún producto en la lista.
        const vistos = new Set(previos.map((p) => p.id));
        return [...previos, ...resultado.productos.filter((p) => !vistos.has(p.id))];
      });
      setPagina(siguiente);
      setHayMas(resultado.hayMas);
    } catch {
      setFallo("No pudimos traer más productos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  if (productos.length === 0) {
    return <SinResultados busqueda={filtros.busqueda} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {productos.map((p) => (
          <TarjetaProducto key={p.id} producto={p} />
        ))}

        {cargando &&
          Array.from({ length: 4 }, (_, i) => <EsqueletoTarjeta key={`carga-${i}`} />)}
      </div>

      <div className="space-y-3 text-center">
        <p aria-live="polite" className="text-sm text-carbon-suave">
          Viendo {productos.length} de {total}{" "}
          {total === 1 ? "producto" : "productos"}
        </p>

        {fallo && (
          <p role="alert" className="rounded-suave bg-fucsia/10 px-4 py-3 text-fucsia-texto">
            {fallo}
          </p>
        )}

        {hayMas && (
          <Boton variante="secundario" onClick={verMas} cargando={cargando}>
            {!cargando && <IconoFlechaAbajo className="h-5 w-5" />}
            {cargando ? "Trayendo más…" : "Ver más productos"}
          </Boton>
        )}

        {!hayMas && productos.length > 12 && (
          <p className="text-sm text-carbon-suave">
            Ya viste todo el catálogo ♡
          </p>
        )}
      </div>
    </div>
  );
}

function SinResultados({ busqueda }: { busqueda?: string }) {
  return (
    <div className="space-y-3 py-20 text-center">
      <p className="flex justify-center text-lila-suave">
        <IconoBuscar className="h-14 w-14" />
      </p>

      <p className="font-display text-2xl text-carbon">
        {busqueda
          ? `No encontramos nada con «${busqueda}»`
          : "Aquí todavía no hay productos"}
      </p>

      <p className="mx-auto max-w-sm text-carbon-suave">
        {busqueda
          ? "Prueba con una palabra más corta, o con la referencia del producto."
          : "Elige otra categoría para seguir viendo."}
      </p>
    </div>
  );
}
