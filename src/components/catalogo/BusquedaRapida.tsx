"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  AccesosBusqueda,
  SinResultados,
  SugerenciasBusqueda,
  type Departamento,
} from "@/components/catalogo/ResultadosBusqueda";
import { Boton } from "@/components/ui/Boton";
import { Giro } from "@/components/ui/Giro";
import { Hoja } from "@/components/ui/Hoja";
import { IconoBuscar } from "@/components/ui/Iconos";
import { useHistorialHoja } from "@/hooks/useHistorialHoja";
import { busquedaAbierta, cerrarBusqueda, useBusquedaAbierta } from "@/lib/busqueda-rapida";
import { compactarReferencia } from "@/lib/data/busqueda";
import { rutaProducto, urlCatalogo } from "@/lib/rutas";
import type { SugerenciaProducto } from "@/lib/types";

type Resultado = { texto: string; total: number; productos: SugerenciaProducto[] };
type Estado = "inactivo" | "cargando" | "listo" | "error";
type IrA = (href: string, scroll: boolean) => void;

const ESPERA_MS = 200;
const MINIMO = 2;

/** Búsqueda rápida: pantalla completa en el celular, diálogo en escritorio. La monta una vez el layout. */
export function BusquedaRapida({ whatsapp, departamentos }: { whatsapp: string; departamentos: Departamento[] }) {
  const { abierta, textoInicial } = useBusquedaAbierta();
  const router = useRouter();
  const destino = useRef<{ href: string; scroll: boolean } | null>(null);

  // Se navega cuando la hoja ya retiró su entrada del historial: «Atrás» vuelve a donde se abrió la
  // búsqueda y el foco no salta a la cabecera después de que abre la ficha.
  const alCerrar = useCallback(() => {
    cerrarBusqueda();
    const pendiente = destino.current;
    destino.current = null;
    if (pendiente) router.push(pendiente.href, { scroll: pendiente.scroll });
  }, [router]);
  const { cerrar } = useHistorialHoja(abierta, alCerrar);

  // Gana el primer toque; los que llegan mientras la hoja sale (sigue pintada 160 ms) no cuentan.
  const irA = useCallback<IrA>(
    (href, scroll) => {
      if (!busquedaAbierta()) return;
      destino.current ??= { href, scroll };
      cerrar();
    },
    [cerrar]
  );

  return (
    <Hoja abierta={abierta} alCerrar={cerrar} titulo="Buscar productos" tituloVisible={false} pantallaCompleta>
      <ContenidoBusqueda textoInicial={textoInicial} whatsapp={whatsapp} departamentos={departamentos} irA={irA} />
    </Hoja>
  );
}

function ContenidoBusqueda({
  textoInicial,
  whatsapp,
  departamentos,
  irA,
}: {
  textoInicial: string;
  whatsapp: string;
  departamentos: Departamento[];
  irA: IrA;
}) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const espera = useRef<number | undefined>(undefined);
  const peticion = useRef<AbortController | null>(null);
  const [texto, setTexto] = useState(textoInicial);
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const buscar = useCallback(async (consulta: string): Promise<Resultado | null> => {
    window.clearTimeout(espera.current);
    peticion.current?.abort();
    const control = new AbortController();
    peticion.current = control;
    setEstado("cargando");
    try {
      const respuesta = await fetch(`/api/buscar?q=${encodeURIComponent(consulta)}`, { signal: control.signal });
      if (!respuesta.ok) throw new Error(`La búsqueda respondió ${respuesta.status}`);
      const datos = (await respuesta.json()) as Omit<Resultado, "texto">;
      if (control.signal.aborted) return null;
      const nuevo = { texto: consulta, total: datos.total, productos: datos.productos };
      setResultado(nuevo);
      setEstado("listo");
      return nuevo;
    } catch {
      if (!control.signal.aborted) setEstado("error");
      return null;
    }
  }, []);

  useEffect(() => {
    const inicial = textoInicial.trim();
    if (inicial.length >= MINIMO) void buscar(inicial);
    return () => {
      window.clearTimeout(espera.current);
      peticion.current?.abort();
    };
  }, [buscar, textoInicial]);

  function alEscribir(valor: string) {
    setTexto(valor);
    window.clearTimeout(espera.current);
    const consulta = valor.trim();
    if (consulta.length >= MINIMO) {
      espera.current = window.setTimeout(() => void buscar(consulta), ESPERA_MS);
      return;
    }
    peticion.current?.abort();
    setResultado(null);
    setEstado("inactivo");
  }

  // Enter: la referencia exacta («usk621» = «USK-621») abre el producto; si no, la lista completa.
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const consulta = texto.trim();
    if (consulta.length < MINIMO) return;
    campo.current?.blur();
    const vigente = resultado?.texto === consulta ? resultado : await buscar(consulta);
    const buscada = compactarReferencia(consulta);
    const exacta = vigente?.productos.find((p) => compactarReferencia(p.referencia) === buscada);
    if (exacta) irA(rutaProducto(exacta.referencia), false);
    else irA(urlCatalogo({ q: consulta }), true);
  }

  function alTocar(evento: MouseEvent<HTMLAnchorElement>, scroll: boolean) {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;
    evento.preventDefault();
    irA(evento.currentTarget.getAttribute("href") ?? "/", scroll);
  }

  const sinTexto = texto.trim().length < MINIMO;
  const vigente = sinTexto ? null : resultado;

  return (
    // Alto fijo en escritorio: el diálogo va centrado y el campo no salta cuando llegan los resultados.
    <div className="flex h-full flex-col md:h-[min(37rem,calc(85dvh-2rem))]">
      <form role="search" onSubmit={enviar} className="shrink-0 pb-3">
        <label htmlFor={id} className="flex min-h-7 items-center pr-12 text-xl font-semibold leading-[26px] text-tinta">
          Buscar
        </label>
        <div className="relative mt-3">
          <IconoBuscar
            tamano={22}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta"
          />
          <input
            ref={campo}
            id={id}
            data-autofocus
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={80}
            placeholder="Nombre o referencia"
            value={texto}
            onChange={(e) => alEscribir(e.target.value)}
            className="block min-h-12 w-full rounded-md border border-borde bg-fondo pl-11 pr-28 text-base text-tinta
                       placeholder:text-tinta-suave [&::-webkit-search-cancel-button]:appearance-none"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
            {estado === "cargando" && <Giro className="size-5 text-tinta-suave" />}
            {texto && (
              <button
                type="button"
                onClick={() => {
                  alEscribir("");
                  campo.current?.focus();
                }}
                className="min-h-11 cursor-pointer rounded-md px-3 text-[15px] font-semibold text-tinta hover:bg-superficie"
              >
                Borrar
              </button>
            )}
          </div>
        </div>
      </form>

      <p role="status" className="sr-only">
        {estado === "cargando" ? "Buscando…" : vigente ? `${vigente.total} ${vigente.total === 1 ? "resultado" : "resultados"}` : ""}
      </p>

      {/* Solo esto se desplaza: el campo queda siempre a la vista, sin `sticky` sobre el relleno de la hoja. */}
      <div
        className="-mx-4 -mb-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4
                   pb-[calc(1rem+env(safe-area-inset-bottom))] md:-mx-6 md:px-6"
      >
        {sinTexto && <AccesosBusqueda departamentos={departamentos} alTocar={alTocar} />}

        {!sinTexto && estado === "error" && (
          <div className="mt-2">
            <p className="text-base text-tinta">No pudimos buscar en este momento.</p>
            <Boton type="button" variante="secundario" tamano="compacto" className="mt-3" onClick={() => void buscar(texto.trim())}>
              Volver a intentar
            </Boton>
          </div>
        )}

        {estado !== "error" && vigente && vigente.productos.length > 0 && (
          <SugerenciasBusqueda texto={vigente.texto} total={vigente.total} productos={vigente.productos} alTocar={alTocar} />
        )}

        {estado === "listo" && vigente?.productos.length === 0 && <SinResultados texto={vigente.texto} whatsapp={whatsapp} />}
      </div>
    </div>
  );
}
