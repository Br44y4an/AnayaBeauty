"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BarraConfirmar } from "@/components/bolsa/BarraConfirmar";
import { BolsaVacia } from "@/components/bolsa/BolsaVacia";
import {
  FormularioDatos,
  enfocarError,
  enfocarPrimerVacio,
  primerCampoVacio,
  useDatosFormulario,
} from "@/components/bolsa/FormularioDatos";
import { GrupoProducto, armarGrupos } from "@/components/bolsa/GrupoProducto";
import { PantallaConfirmando } from "@/components/bolsa/PantallaConfirmando";
import { AvisoAdicional } from "@/components/bolsa/PedidosRecientes";
import { ProgresoBeneficio } from "@/components/bolsa/ProgresoBeneficio";
import { ResumenBolsa } from "@/components/bolsa/ResumenBolsa";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { IconoChevron } from "@/components/ui/Iconos";
import { useBolsa } from "@/hooks/useBolsa";
import { useConfirmarPedido } from "@/hooks/useConfirmarPedido";
import { itemsParaPedido } from "@/lib/carrito/reconciliar";
import { pedidoReciente } from "@/lib/celular";

const COLUMNAS = "lg:grid lg:grid-cols-12 lg:items-start lg:gap-12";
// Sin sticky: el panel con el formulario es más alto que la pantalla y fijo escondería el botón.
const PANEL = "mt-6 space-y-6 border-t border-linea pt-6 lg:col-span-5 lg:mt-0 lg:rounded-md lg:border lg:p-6";

/** Orquesta la bolsa: datos frescos, grupos por producto, resumen, datos de la clienta y confirmación. */
export function VistaBolsa({ envioInfo, whatsappNegocio }: { envioInfo: string; whatsappNegocio: string }) {
  const bolsa = useBolsa();
  const [valores, cambiar] = useDatosFormulario();
  // Solo se usa con la bolsa ya hidratada (en el cliente); en el servidor da null.
  const [reciente] = useState(pedidoReciente);
  const { resultado, enviando, accion } = useConfirmarPedido({
    alFallar: (fallo) => {
      if (fallo.campo === "bolsa") bolsa.reintentar();
      enfocarError(fallo);
    },
  });

  const { estado, datos, reconciliado, totales } = bolsa;
  let cuerpo: ReactNode;
  let conteo: string | null = null;

  if (estado === "hidratando" || estado === "cargando") {
    cuerpo = <EsqueletoBolsa />;
  } else if (estado === "error") {
    cuerpo = (
      <div className="mx-auto max-w-md py-10 text-center">
        <h2 className="text-xl font-semibold leading-[26px] text-tinta">No pudimos cargar tu bolsa</h2>
        <p className="mt-2 text-tinta-suave">Revisa tu conexión. Lo que elegiste sigue guardado.</p>
        <Boton className="mt-6" onClick={bolsa.reintentar}>
          Volver a intentar
        </Boton>
      </div>
    );
  } else if (!reconciliado || reconciliado.lineas.length === 0 || !datos || !totales) {
    cuerpo = <BolsaVacia />;
  } else {
    const grupos = armarGrupos(reconciliado, datos, totales.porMayor);
    const items = itemsParaPedido(reconciliado);
    conteo = `${grupos.length} ${grupos.length === 1 ? "producto" : "productos"}`;

    cuerpo = (
      <div className={COLUMNAS}>
        <div className="lg:col-span-7">
          {reciente && <AvisoAdicional pedido={reciente} />}
          <ul aria-label="Productos en tu bolsa" className="mt-2">
            {grupos.map((g) => (
              <GrupoProducto key={g.productoId} grupo={g} />
            ))}
          </ul>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-tinta">
            <IconoChevron direccion="izquierda" tamano={20} />
            Seguir comprando
          </Link>
        </div>

        <div className={PANEL}>
          {items.length === 0 ? (
            <div className="text-center lg:text-left">
              <h2 className="text-xl font-semibold leading-[26px] text-tinta">
                Ninguno de tus productos está disponible
              </h2>
              <p className="mt-2 text-tinta-suave">Se agotaron o salieron del catálogo.</p>
              <BotonEnlace href="/" className="mt-5">
                Ver el catálogo
              </BotonEnlace>
            </div>
          ) : (
            <>
              <ProgresoBeneficio totales={totales} reglas={datos.reglas} umbralPorMayor={datos.umbralPorMayor} />
              <ResumenBolsa totales={totales} envioInfo={envioInfo} />
              <div className="border-t border-linea pt-6">
                <FormularioDatos
                  valores={valores}
                  onCambiar={cambiar}
                  accion={accion}
                  items={JSON.stringify(items)}
                  adicional={reciente?.numero ?? null}
                  error={resultado && !resultado.ok ? resultado : null}
                  whatsappNegocio={whatsappNegocio}
                />
              </div>
              <BarraConfirmar
                total={totales.total}
                completo={primerCampoVacio(valores) === null}
                enviando={enviando}
                alCompletar={() => enfocarPrimerVacio(valores)}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {(enviando || resultado?.ok) && <PantallaConfirmando />}
      <div className="flex items-baseline gap-3 pb-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Tu bolsa</h1>
        {conteo && <p className="text-[15px] leading-5 text-tinta-suave">{conteo}</p>}
      </div>
      {cuerpo}
    </>
  );
}

/** Misma forma que la bolsa cargada: la usan la hidratación y `loading.tsx`, sin saltos entre ambas. */
export function EsqueletoBolsa() {
  return (
    <div role="status" aria-label="Cargando tu bolsa" className={COLUMNAS}>
      <div className="mt-2 lg:col-span-7">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 border-b border-linea py-5">
            <Esqueleto className="size-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <Esqueleto className="h-4 w-3/4" />
              <Esqueleto className="mt-2 h-3 w-20" />
              <Esqueleto className="mt-2 h-3 w-36" />
              <Esqueleto className="mt-4 h-11 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 lg:col-span-5 lg:mt-2">
        <Esqueleto className="h-4 w-2/3" />
        <Esqueleto className="h-8 w-full" />
        <Esqueleto className="h-40 w-full rounded-md" />
      </div>
    </div>
  );
}
