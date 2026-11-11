"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Boton, BotonEnlace, estilosBoton } from "@/components/ui/Boton";
import { IconoBolsa, IconoCheck, IconoWhatsApp } from "@/components/ui/Iconos";
import { Insignia } from "@/components/ui/Insignia";
import { Stepper } from "@/components/ui/Stepper";
import { useModalProducto } from "@/components/producto/ModalProducto";
import { PreciosPorCantidad } from "@/components/producto/PreciosPorCantidad";
import { SelectorVariantes, type ManejadorSelector } from "@/components/producto/SelectorVariantes";
import { CLAVE_UNICA, useCompraProducto, useLineasEnBolsa } from "@/hooks/useCompraProducto";
import { pesos } from "@/lib/format";
import { nombreVariante, unaVariante } from "@/lib/variantes";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Producto } from "@/lib/types";

const POCAS_UNIDADES = 5;
const BOTON_WHATSAPP = estilosBoton({ variante: "secundario", tamano: "grande", ancho: true });

type Props = {
  producto: Producto;
  variante: "modal" | "pagina";
  /** Número del negocio para «Preguntar por WhatsApp»; sin él se usa el de respaldo. */
  whatsapp?: string | null;
  /** Va entre la compra y el pie fijo (la descripción). */
  children?: ReactNode;
};

/** Precio, variantes o cantidad, lo que ya hay en la bolsa y el pie fijo con la acción principal. */
export function PanelCompra({ producto, variante, whatsapp = null, children }: Props) {
  const { seleccion, cambiar, resumen, agregar } = useCompraProducto(producto);
  const lineas = useLineasEnBolsa(producto.id);
  const modal = useModalProducto();
  const selector = useRef<ManejadorSelector>(null);
  const [error, setError] = useState<string | null>(null);

  const variantes = producto.variantes ?? [];
  const etiqueta = producto.etiquetaVariante;
  const agotado = resumen.bloqueo === "agotado" || (variantes.length > 0 && variantes.every((v) => v.agotado));
  const sinPrecio = !agotado && resumen.bloqueo === "sin-precio";
  const lleno = !agotado && !sinPrecio && resumen.maxNuevas === 0;
  const referencia = `${producto.nombre} (Ref. ${producto.referencia})`;

  function alCambiar(clave: string, cantidad: number) {
    setError(null);
    cambiar(clave, cantidad);
  }

  function alPulsar() {
    if (resumen.bloqueo === "sin-seleccion") {
      setError(`Elige al menos ${unaVariante(etiqueta)}`);
      selector.current?.enfocar();
    } else if (resumen.bloqueo === "supera-stock") {
      setError(`Solo quedan ${resumen.maxNuevas} disponibles. Ajusta la cantidad.`);
    } else if (agregar()) {
      setError(null);
      if (variante === "modal") modal?.cerrar();
    }
  }

  let compra: ReactNode;
  let accion: ReactNode;
  if (agotado || sinPrecio) {
    const [mensaje, etiquetaEnlace] = agotado
      ? [`Hola, quiero saber cuándo vuelve ${referencia}.`, "Preguntar por WhatsApp"]
      : [`Hola, quiero saber el precio de ${referencia}.`, "Preguntar el precio"];
    compra = (
      <div>
        {sinPrecio ? (
          <p className="text-xl font-semibold leading-[26px] text-tinta">Precio por confirmar</p>
        ) : (
          producto.escalones.length > 0 && <PrecioUnidad precio={producto.escalones[0].precioUnitario} />
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-5 text-tinta-suave">
          {agotado && <Insignia>Agotado</Insignia>}
          {agotado
            ? "Escríbenos por WhatsApp y te avisamos cuando vuelva."
            : "Este producto aún no tiene precio. Pregúntanos por WhatsApp."}
        </p>
      </div>
    );
    accion = (
      <a href={enlaceWhatsApp(mensaje, whatsapp)} target="_blank" rel="noopener noreferrer" className={BOTON_WHATSAPP}>
        <IconoWhatsApp tamano={22} />
        {etiquetaEnlace}
      </a>
    );
  } else {
    const mezcla =
      variantes.length > 1 && producto.escalones.length > 1
        ? `Puedes mezclar ${nombreVariante(etiqueta, 2)}: cuentan ${unaVariante(etiqueta).startsWith("una") ? "juntas" : "juntos"} para el precio.`
        : null;
    compra = (
      <>
        <PreciosPorCantidad
          escalones={producto.escalones}
          unidadesTotales={resumen.unidadesTotales}
          siguiente={lleno ? null : resumen.siguiente}
          nota={mezcla}
        />
        {producto.stock <= POCAS_UNIDADES && (
          <p className="mt-3">
            <Insignia tono="alerta">{`Quedan ${producto.stock}`}</Insignia>
          </p>
        )}
        {lleno ? (
          <p className="mt-6 text-[15px] leading-5 text-tinta">Ya tienes en tu bolsa todas las unidades disponibles.</p>
        ) : variantes.length > 0 ? (
          <div className="mt-7">
            <SelectorVariantes
              ref={selector}
              variantes={variantes}
              etiqueta={etiqueta}
              seleccion={seleccion}
              enBolsa={Object.fromEntries(lineas.map((l) => [l.tonoId ?? "", l.cantidad]))}
              disponibles={resumen.maxNuevas}
              alCambiar={alCambiar}
              error={error}
              nivelTitulo={variante === "pagina" ? 2 : 3}
            />
          </div>
        ) : (
          <div className="mt-7">
            <div className="flex items-center justify-between gap-4">
              <p className="text-base font-semibold leading-6 text-tinta">Cantidad</p>
              <Stepper
                valor={seleccion[CLAVE_UNICA] ?? 0}
                min={1}
                max={resumen.maxNuevas}
                onCambiar={(n) => alCambiar(CLAVE_UNICA, n)}
                etiqueta={producto.nombre}
              />
            </div>
            {error && <p className="mt-2 text-sm leading-5 text-error">{error}</p>}
          </div>
        )}
      </>
    );
    accion = lleno ? (
      <BotonEnlace href="/carrito" tamano="grande" ancho>
        Ver bolsa
      </BotonEnlace>
    ) : (
      <Boton tamano="grande" ancho onClick={alPulsar}>
        {resumen.unidadesNuevas > 0 && <IconoBolsa tamano={22} />}
        {resumen.unidadesNuevas > 0
          ? `Agregar ${resumen.unidadesNuevas} · ${pesos(resumen.subtotalNuevas)}`
          : `Elige ${unaVariante(etiqueta)}`}
      </Boton>
    );
  }

  const enBolsa = lineas.reduce((total, l) => total + l.cantidad, 0);

  return (
    <div className="flex flex-col">
      {compra}
      {enBolsa > 0 && (
        <div className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-md bg-ahorro-fondo pl-3 pr-1">
          <p className="flex items-center gap-2 text-[15px] font-medium leading-5 text-ahorro">
            <IconoCheck tamano={20} />
            <span>{`${enBolsa} en tu bolsa`}</span>
          </p>
          {!lleno && (
            <Link
              href="/carrito"
              className="flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-tinta underline
                         decoration-1 underline-offset-4"
            >
              Ver bolsa
            </Link>
          )}
        </div>
      )}
      {children}
      {/* En la hoja, el pie se pega al borde del panel y no al de su relleno de 1 rem. */}
      <div
        data-pie-fijo={modal?.cerrando ? undefined : ""}
        className={`sticky z-10 -mx-4 mt-8 border-t border-linea bg-fondo px-4 pt-3
                    pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:-mx-2 md:px-2
                    ${variante === "modal" ? "-bottom-4" : "bottom-0"}`}
      >
        {accion}
      </div>
    </div>
  );
}

function PrecioUnidad({ precio }: { precio: number }) {
  return (
    <p className="text-2xl font-bold leading-[30px] tabular-nums text-tinta">
      {pesos(precio)} <span className="text-base font-normal text-tinta-suave">c/u</span>
    </p>
  );
}
