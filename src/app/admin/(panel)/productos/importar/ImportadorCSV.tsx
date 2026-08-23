"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parsearCSV, type FilaCSV } from "@/lib/csv";
import { subtotalPara } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import type { ResumenImportacion } from "./actions";
import { importarProductos } from "./actions";

export function ImportadorCSV() {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const [filas, setFilas] = useState<FilaCSV[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");

  async function leerArchivo(archivo: File) {
    setResumen(null);
    setNombreArchivo(archivo.name);

    const texto = await archivo.text();
    const resultado = parsearCSV(texto);

    setFilas(resultado.filas);
    setErrores(resultado.errores);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-tarjeta bg-petalo p-5 shadow-petalo">
        <p className="text-sm text-carbon">
          Sube un archivo CSV con tus productos. Si una referencia ya existe, se
          actualiza en vez de duplicarse, así que puedes volver a subir el mismo
          archivo corregido sin problema.
        </p>

        <a
          href="/plantilla-productos.csv"
          download
          className="inline-block text-sm font-semibold text-lila underline hover:text-fucsia"
        >
          Descargar plantilla de ejemplo
        </a>

        <p className="text-xs text-carbon-suave">
          Columnas: <code>referencia, nombre, descripcion, categoria, stock,
          precio_1, precio_3, precio_6</code>. Solo <code>precio_1</code> es
          obligatorio; deja vacíos los otros si ese producto no tiene combos.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) leerArchivo(archivo);
          }}
          className="w-full text-sm text-carbon-suave file:mr-3 file:cursor-pointer
                     file:rounded-pastilla file:border-0 file:bg-fucsia file:px-5
                     file:py-2.5 file:text-sm file:font-semibold file:text-petalo"
        />
      </div>

      {errores.length > 0 && (
        <div className="rounded-tarjeta bg-fucsia/10 p-4">
          <p className="pb-2 text-sm font-semibold text-fucsia">
            {errores.length} {errores.length === 1 ? "fila tiene" : "filas tienen"} problemas
            y no se importarán:
          </p>
          <ul className="space-y-1 text-xs text-carbon">
            {errores.slice(0, 20).map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
            {errores.length > 20 && <li>… y {errores.length - 20} más</li>}
          </ul>
        </div>
      )}

      {filas.length > 0 && !resumen && (
        <div className="space-y-4">
          <div className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
            <p className="pb-3 text-sm font-semibold text-carbon">
              {filas.length} productos listos desde {nombreArchivo}
            </p>

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-petalo">
                  <tr className="text-carbon-suave">
                    <th className="pb-2">Ref.</th>
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2 text-center">Stock</th>
                    <th className="pb-2 text-right">1 und</th>
                    <th className="pb-2 text-right">3 unds</th>
                    <th className="pb-2 text-right">6 unds</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.referencia} className="border-t border-rosa-nube">
                      <td className="py-2 font-bold text-lila">{f.referencia}</td>
                      <td className="py-2 text-carbon">{f.nombre}</td>
                      <td className="py-2 text-center text-carbon">{f.stock}</td>
                      <td className="py-2 text-right text-carbon">
                        {pesos(subtotalPara(f.escalones, 1))}
                      </td>
                      <td className="py-2 text-right text-carbon">
                        {pesos(subtotalPara(f.escalones, 3))}
                      </td>
                      <td className="py-2 text-right text-fucsia">
                        {pesos(subtotalPara(f.escalones, 6))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Boton
            disabled={pendiente}
            onClick={() =>
              iniciarTransicion(async () => {
                setResumen(await importarProductos(filas));
                router.refresh();
              })
            }
          >
            {pendiente ? "Importando…" : `Importar ${filas.length} productos`}
          </Boton>
        </div>
      )}

      {resumen && (
        <div className="space-y-3 rounded-tarjeta bg-petalo p-5 shadow-flotante">
          <p className="font-display text-xl text-fucsia">Importación terminada</p>
          <ul className="space-y-1 text-sm text-carbon">
            <li>✓ {resumen.creados} productos nuevos</li>
            <li>✓ {resumen.actualizados} productos actualizados</li>
            {resumen.errores.length > 0 && (
              <li className="text-fucsia">✗ {resumen.errores.length} con error</li>
            )}
          </ul>

          {resumen.errores.length > 0 && (
            <ul className="space-y-1 text-xs text-carbon-suave">
              {resumen.errores.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}

          <Link href="/admin/productos" className="inline-block">
            <Boton>Ver mis productos</Boton>
          </Link>
        </div>
      )}
    </div>
  );
}
