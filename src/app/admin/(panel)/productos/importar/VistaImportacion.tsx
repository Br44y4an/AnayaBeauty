"use client";

import { Boton } from "@/components/ui/Boton";
import { IconoChevron } from "@/components/ui/Iconos";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { Interruptor } from "@/components/admin/CamposPanel";
import { pesos } from "@/lib/format";
import type { VistaPrevia } from "./actions";

const MOSTRAR_ABIERTO = 10;
const RESUMEN =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold text-tinta " +
  "[&::-webkit-details-marker]:hidden";

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const productos = (n: number) => (n === 1 ? "1 producto" : `${n} productos`);

export function ListaMensajes({ mensajes }: { mensajes: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {mensajes.map((m, i) => (
        <li key={i}>{capitalizar(m)}</li>
      ))}
    </ul>
  );
}

function Cifra({ valor, etiqueta, detalle }: { valor: number; etiqueta: string; detalle?: string }) {
  return (
    <div className="border-t border-linea pt-3">
      <dt className="text-[13px] leading-[18px] text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-0.5 text-2xl font-semibold leading-[30px] text-tinta tabular-nums">{valor}</dd>
      {detalle && <dd className="mt-0.5 text-[13px] leading-[18px] text-tinta-suave">{detalle}</dd>}
    </div>
  );
}

/** El resumen previo: cuántos se crean, qué cambia en cada uno y qué filas no se pueden leer. */
export function VistaImportacion({
  vista,
  publicar,
  alCambiarPublicar,
  importando,
  alImportar,
}: {
  vista: VistaPrevia;
  publicar: boolean;
  alCambiarPublicar: (publicar: boolean) => void;
  importando: boolean;
  alImportar: () => void;
}) {
  const { nuevos, cambios, sinCambios, errores, avisos, cambianPrecio, quedanSinStock } = vista;
  const detallePrecios = [
    cambianPrecio > 0 && `${cambianPrecio} con precios nuevos`,
    quedanSinStock > 0 && `${quedanSinStock} sin unidades`,
  ].filter(Boolean);
  const hayTrabajo = nuevos.length + cambios.length > 0;

  return (
    <section aria-labelledby="vista-titulo" className="space-y-6">
      <h2 id="vista-titulo" className="text-xl font-semibold leading-[26px] text-tinta">
        Antes de importar
      </h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Cifra valor={nuevos.length} etiqueta="Nuevos" />
        <Cifra valor={cambios.length} etiqueta="Cambian" detalle={detallePrecios.join(" · ") || undefined} />
        <Cifra valor={sinCambios} etiqueta="Quedan igual" />
        <Cifra valor={errores.length} etiqueta="Filas con problemas" />
      </dl>

      {quedanSinStock > 0 && (
        <AvisoPanel tono="alerta">
          {quedanSinStock === 1
            ? "1 producto quedaría con 0 unidades y la tienda lo mostraría agotado."
            : `${quedanSinStock} productos quedarían con 0 unidades y la tienda los mostraría agotados.`}
        </AvisoPanel>
      )}
      {errores.length > 0 && (
        <AvisoPanel tono="error">
          <p className="font-semibold">
            {errores.length === 1
              ? "Esta fila no se puede leer y no se importa:"
              : "Estas filas no se pueden leer y no se importan:"}
          </p>
          <ListaMensajes mensajes={errores} />
        </AvisoPanel>
      )}
      {avisos.length > 0 && (
        <AvisoPanel tono="alerta">
          <p className="font-semibold">Revisa también:</p>
          <ListaMensajes mensajes={avisos} />
        </AvisoPanel>
      )}

      {cambios.length > 0 && (
        <details open={cambios.length <= MOSTRAR_ABIERTO} className="group">
          <summary className={RESUMEN}>
            Qué cambia en {cambios.length === 1 ? "el producto" : `los ${cambios.length} productos`}
            <IconoChevron tamano={20} className="transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <ul className="mt-2 divide-y divide-linea border-y border-linea">
            {cambios.map((c) => (
              <li key={c.referencia} className="py-3">
                <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                  Ref. {c.referencia}
                </p>
                <p className="mt-0.5 text-[15px] font-medium leading-5 text-tinta">{c.nombre}</p>
                <ul className="mt-1 space-y-0.5 text-[13px] leading-[18px] text-tinta-suave tabular-nums">
                  {c.lineas.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}

      {nuevos.length > 0 && (
        <details open={nuevos.length <= MOSTRAR_ABIERTO} className="group">
          <summary className={RESUMEN}>
            {nuevos.length === 1 ? "El producto nuevo" : `Los ${nuevos.length} productos nuevos`}
            <IconoChevron tamano={20} className="transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <ul className="mt-2 divide-y divide-linea border-y border-linea">
            {nuevos.map((n) => (
              <li key={n.referencia} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">
                    Ref. {n.referencia}
                  </p>
                  <p className="mt-0.5 text-[15px] font-medium leading-5 text-tinta">{n.nombre}</p>
                </div>
                <p className="shrink-0 text-right text-[13px] leading-[18px] text-tinta-suave tabular-nums">
                  <span className="block text-[15px] font-semibold text-tinta">{pesos(n.precio)} c/u</span>
                  {n.stock} en stock
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {hayTrabajo ? (
        <div className="space-y-4 border-t border-linea pt-6">
          {nuevos.length > 0 && (
            <Interruptor
              id="publicar-nuevos"
              etiqueta="Mostrar los productos nuevos en la tienda"
              ayuda="Apágalo para crearlos ocultos y revisarlos antes, por ejemplo para subirles la foto."
              checked={publicar}
              onChange={(e) => alCambiarPublicar(e.target.checked)}
            />
          )}
          <Boton type="button" cargando={importando} onClick={alImportar}>
            {importando ? "Importando…" : textoImportar(nuevos.length, cambios.length)}
          </Boton>
        </div>
      ) : (
        <p className="text-[15px] text-tinta-suave">
          {errores.length > 0
            ? "No hay nada que importar: corrige las filas con problemas y vuelve a elegir el archivo."
            : "Este archivo no cambia nada: los productos ya tienen esos datos."}
        </p>
      )}
    </section>
  );
}

function textoImportar(nuevos: number, cambios: number): string {
  const partes = [
    nuevos > 0 && `crear ${productos(nuevos)}`,
    cambios > 0 && `actualizar ${productos(cambios)}`,
  ].filter(Boolean);
  return capitalizar(partes.join(" y "));
}
