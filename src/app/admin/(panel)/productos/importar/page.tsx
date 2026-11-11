import Link from "next/link";
import { IconoAtras } from "@/components/ui/Iconos";
import { ImportadorCSV } from "./ImportadorCSV";

const COLUMNAS = "referencia, nombre, descripcion, categoria, stock, precio_1, precio_3, precio_6";

export default function PaginaImportar() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/productos"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-semibold text-tinta hover:bg-superficie"
      >
        <IconoAtras tamano={20} />
        Productos
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-[30px] text-tinta">Importar productos</h1>
        <p className="text-[15px] leading-6 text-tinta-suave">
          Crea productos o cambia precios y stock de muchos a la vez con un archivo CSV. Antes de guardar te mostramos
          qué va a cambiar.
        </p>
      </header>

      <section aria-labelledby="reglas-titulo" className="space-y-3 rounded-md bg-superficie px-4 py-4">
        <h2 id="reglas-titulo" className="text-[15px] font-semibold leading-5 text-tinta">
          Cómo se lee el archivo
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-tinta">
          <li>
            Primera fila con estos títulos, en este orden: <span className="break-words font-mono text-sm">{COLUMNAS}</span>.
          </li>
          <li>En un producto que ya existe solo cambia lo que traiga valor: una celda vacía deja el dato como está.</li>
          <li>El archivo no muestra ni oculta productos que ya existen.</li>
          <li>Para crear un producto hacen falta el nombre y precio_1, el precio de 1 unidad.</li>
          <li>Sirven los CSV de Excel, separados por coma o por punto y coma.</li>
        </ul>
        <a
          href="/plantilla-productos.csv"
          download
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-tinta underline underline-offset-2"
        >
          Descargar la plantilla
        </a>
      </section>

      <ImportadorCSV />
    </div>
  );
}
