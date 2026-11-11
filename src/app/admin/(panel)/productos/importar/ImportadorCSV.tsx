"use client";

import { useRef, useState, useTransition } from "react";
import { Boton, BotonEnlace, estilosBoton } from "@/components/ui/Boton";
import { Giro } from "@/components/ui/Giro";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { aplicarImportacion, revisarImportacion, type ResumenImportacion, type VistaPrevia } from "./actions";
import { ListaMensajes, VistaImportacion } from "./VistaImportacion";

const SIN_CONEXION = "No se pudo conectar con el servidor. Revisa tu internet e intenta otra vez.";

type Archivo = { nombre: string; texto: string };

/** Elegir el archivo, ver qué cambiaría y confirmar. Nada se escribe hasta pulsar «Importar». */
export function ImportadorCSV() {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicar, setPublicar] = useState(true);
  const [revisando, iniciarRevision] = useTransition();
  const [importando, iniciarImportacion] = useTransition();

  function reiniciar() {
    setArchivo(null);
    setVista(null);
    setResumen(null);
    setError(null);
    if (entrada.current) {
      entrada.current.value = "";
      entrada.current.focus();
    }
  }

  function revisar(elegido: File) {
    setVista(null);
    setResumen(null);
    setError(null);
    iniciarRevision(async () => {
      let texto: string;
      try {
        texto = await elegido.text();
      } catch {
        setError("No pudimos leer ese archivo. Guárdalo otra vez como CSV e inténtalo de nuevo.");
        return;
      }
      setArchivo({ nombre: elegido.name, texto });
      const resultado = await revisarImportacion(texto).catch(() => null);
      if (resultado?.ok) setVista(resultado.vista);
      else setError(resultado?.error ?? SIN_CONEXION);
    });
  }

  function importar() {
    if (!archivo) return;
    setError(null);
    iniciarImportacion(async () => {
      const resultado = await aplicarImportacion(archivo.texto, publicar).catch(() => null);
      if (resultado?.ok) {
        setResumen(resultado.resumen);
        setVista(null);
      } else {
        setError(resultado?.error ?? SIN_CONEXION);
      }
    });
  }

  if (resumen) {
    const { creados, actualizados, errores } = resumen;
    return (
      <div className="space-y-4">
        <AvisoPanel tono={errores.length > 0 ? "alerta" : "exito"}>
          Importación terminada: {creados} {creados === 1 ? "producto nuevo" : "productos nuevos"} y {actualizados}{" "}
          {actualizados === 1 ? "actualizado" : "actualizados"}.
        </AvisoPanel>
        {errores.length > 0 && (
          <AvisoPanel tono="error">
            <p className="font-semibold">Esto no se pudo guardar:</p>
            <ListaMensajes mensajes={errores} />
          </AvisoPanel>
        )}
        <div className="flex flex-wrap gap-3">
          <BotonEnlace href="/admin/productos">Ver productos</BotonEnlace>
          <Boton type="button" variante="fantasma" onClick={reiniciar}>
            Importar otro archivo
          </Boton>
        </div>
      </div>
    );
  }

  const ocupado = revisando || importando;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          id="archivo-csv"
          type="file"
          accept=".csv,text/csv"
          disabled={ocupado}
          onChange={(e) => {
            const elegido = e.target.files?.[0];
            if (elegido) revisar(elegido);
          }}
          className="peer sr-only"
        />
        <label
          htmlFor="archivo-csv"
          className={estilosBoton({
            variante: archivo ? "contorno" : "primario",
            className:
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acento " +
              "peer-disabled:cursor-wait peer-disabled:bg-inactivo peer-disabled:text-tinta-suave",
          })}
        >
          {archivo ? "Elegir otro archivo" : "Elegir archivo CSV"}
        </label>
        {archivo && <span className="min-w-0 break-all text-[15px] text-tinta-suave">{archivo.nombre}</span>}
        <span role="status" className="inline-flex items-center gap-2 text-[15px] text-tinta">
          {ocupado && <Giro />}
          {revisando ? "Revisando el archivo…" : importando ? "Importando, no cierres esta página…" : ""}
        </span>
      </div>

      {error && <AvisoPanel tono="error">{error}</AvisoPanel>}

      {vista && (
        <VistaImportacion
          vista={vista}
          publicar={publicar}
          alCambiarPublicar={setPublicar}
          importando={importando}
          alImportar={importar}
        />
      )}
    </div>
  );
}
