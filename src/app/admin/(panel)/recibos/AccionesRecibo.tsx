"use client";

import { useState, useSyncExternalStore } from "react";
import { Boton } from "@/components/ui/Boton";
import { IconoCompartir, IconoInfo } from "@/components/ui/Iconos";
import { encabezadoDocumento, type DatosRecibo } from "@/lib/admin/recibo";
import { mostrarAviso } from "@/lib/avisos";

const sinSuscripcion = () => () => {};

/** Solo los celulares que comparten archivos (WhatsApp, correo) muestran «Compartir». */
function puedeCompartirArchivos(): boolean {
  try {
    const prueba = new File([""], "recibo.pdf", { type: "application/pdf" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [prueba] });
  } catch {
    return false;
  }
}

const ERROR_PDF = { titulo: "No se pudo generar el PDF", detalle: "Intenta otra vez en un momento." };

export function AccionesRecibo({ datos, falta }: { datos: DatosRecibo; falta: string | null }) {
  const [trabajando, setTrabajando] = useState<"descargar" | "compartir" | null>(null);
  const puedeCompartir = useSyncExternalStore(sinSuscripcion, puedeCompartirArchivos, () => false);
  const idFalta = "recibo-falta";
  const inactivo = falta !== null || trabajando !== null;

  // jsPDF solo se carga cuando se pide el PDF: la página abre más rápido en el celular.
  async function descargar() {
    setTrabajando("descargar");
    try {
      const { descargarReciboPDF } = await import("@/lib/pdf/recibo");
      await descargarReciboPDF(datos);
    } catch {
      mostrarAviso(ERROR_PDF);
    } finally {
      setTrabajando(null);
    }
  }

  async function compartir() {
    setTrabajando("compartir");
    let archivo: File | null = null;
    const titulo = encabezadoDocumento(datos.titulo, datos.numero);
    try {
      const { generarArchivoRecibo } = await import("@/lib/pdf/recibo");
      archivo = await generarArchivoRecibo(datos);
      await navigator.share({ files: [archivo], title: titulo });
    } catch (error) {
      const nombre = (error as Error | null)?.name;
      const listo = archivo;
      // Safari niega compartir si armar el PDF tardó más que el toque: se ofrece otro toque.
      if (nombre === "NotAllowedError" && listo) {
        mostrarAviso({
          titulo: "El PDF está listo",
          accion: { etiqueta: "Compartir", alHacer: () => void navigator.share({ files: [listo], title: titulo }).catch(() => {}) },
        });
      } else if (nombre !== "AbortError") {
        mostrarAviso(archivo ? { titulo: "No se pudo compartir", detalle: "Descarga el PDF y envíalo por WhatsApp." } : ERROR_PDF);
      }
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="space-y-3">
      {falta && (
        <p id={idFalta} className="flex items-start gap-2 text-[15px] leading-6 text-tinta">
          <IconoInfo tamano={20} className="mt-0.5 shrink-0 text-tinta-suave" />
          {falta}
        </p>
      )}
      <div className={`grid gap-2 ${puedeCompartir ? "grid-cols-2" : ""}`}>
        <Boton
          type="button"
          ancho
          disabled={inactivo}
          cargando={trabajando === "descargar"}
          aria-describedby={falta ? idFalta : undefined}
          onClick={descargar}
        >
          Descargar PDF
        </Boton>
        {puedeCompartir && (
          <Boton
            type="button"
            variante="secundario"
            ancho
            disabled={inactivo}
            cargando={trabajando === "compartir"}
            aria-describedby={falta ? idFalta : undefined}
            onClick={compartir}
          >
            <IconoCompartir tamano={20} />
            Compartir
          </Boton>
        )}
      </div>
    </div>
  );
}
