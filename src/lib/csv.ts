import type { Escalon } from "@/lib/pricing";

/** Una fila del archivo. Una celda vacía llega como null: al importar significa «no tocar». */
export type FilaCSV = {
  linea: number;
  referencia: string;
  nombre: string | null;
  descripcion: string | null;
  categoria: string | null;
  stock: number | null;
  /** Solo los precios que trae la fila; vacío = no cambia los precios. */
  escalones: Escalon[];
};

/** Divide una línea respetando el separador que va dentro de comillas. */
function dividirLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i];

    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === separador && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }

  campos.push(actual.trim());
  return campos;
}

/** Excel en español guarda los CSV con «;»: se elige el separador que más aparece en la cabecera. */
function separadorDe(cabecera: string): string {
  const contar = (s: string) => cabecera.split(s).length - 1;
  return contar(";") > contar(",") ? ";" : ",";
}

/**
 * Convierte un precio escrito por una persona a número entero.
 * Acepta "35000", "35.000" y "$35.000" — los puntos son separadores
 * de miles en Colombia, no decimales.
 */
function aNumero(texto: string | undefined): number {
  if (!texto) return 0;
  const limpio = texto.replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : 0;
}

/** null si la celda está vacía; NaN si trae algo que no es un entero (también «-3»). */
function aStock(texto: string | undefined): number | null {
  const limpio = (texto ?? "").replace(/[\s.]/g, "");
  if (!limpio) return null;
  return /^\d{1,7}$/.test(limpio) ? Number(limpio) : NaN;
}

const textoONulo = (texto: string | undefined) => texto?.trim() || null;

/** Las columnas se leen por posición: un archivo con otro orden pondría nombres donde van referencias. */
const COLUMNAS = ["referencia", "nombre", "descripcion", "categoria", "stock", "precio_1", "precio_3", "precio_6"];

const titulo = (celda: string) =>
  celda.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parsearCSV(texto: string): { filas: FilaCSV[]; errores: string[] } {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const separador = separadorDe(lineas[0] ?? "");
  const filas: FilaCSV[] = [];
  const errores: string[] = [];

  if (!lineas.some((l) => l.trim())) return { filas, errores };
  const titulos = dividirLinea(lineas[0], separador).map(titulo);
  if (COLUMNAS.some((columna, i) => titulos[i] !== columna)) {
    return { filas, errores: [`la primera línea debe tener los títulos ${COLUMNAS.join(", ")}`] };
  }

  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea.trim()) continue;

    const numeroLinea = i + 1;
    const [referencia, nombre, descripcion, categoria, stockTexto, p1, p3, p6] = dividirLinea(
      linea,
      separador
    );

    if (!referencia) {
      errores.push(`línea ${numeroLinea}: falta la referencia`);
      continue;
    }

    const precios = [
      { minCantidad: 1, precioUnitario: aNumero(p1) },
      { minCantidad: 3, precioUnitario: aNumero(p3) },
      { minCantidad: 6, precioUnitario: aNumero(p6) },
    ];
    const escalones = precios.filter((e) => e.precioUnitario > 0);

    // Sin ningún precio la fila no toca los precios; con alguno, el de 1 unidad es obligatorio.
    if (escalones.length > 0 && precios[0].precioUnitario <= 0) {
      errores.push(
        `línea ${numeroLinea} (${referencia}): falta precio_1, el precio de 1 unidad`
      );
      continue;
    }

    const stock = aStock(stockTexto);
    if (Number.isNaN(stock)) {
      errores.push(`línea ${numeroLinea} (${referencia}): el stock «${stockTexto}» no es un número entero`);
      continue;
    }

    filas.push({
      linea: numeroLinea,
      referencia: referencia.toUpperCase(),
      nombre: textoONulo(nombre),
      descripcion: textoONulo(descripcion),
      categoria: textoONulo(categoria),
      stock,
      escalones,
    });
  }

  return { filas, errores };
}
