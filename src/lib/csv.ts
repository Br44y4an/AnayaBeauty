export type FilaCSV = {
  referencia: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  stock: number;
  escalones: { minCantidad: number; precioUnitario: number }[];
};

/** Divide una línea respetando las comas que van dentro de comillas. */
function dividirLinea(linea: string): string[] {
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
    } else if (caracter === "," && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }

  campos.push(actual.trim());
  return campos;
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

export function parsearCSV(texto: string): { filas: FilaCSV[]; errores: string[] } {
  const lineas = texto.split(/\r?\n/);
  const filas: FilaCSV[] = [];
  const errores: string[] = [];

  // La primera línea es la cabecera; se salta
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea.trim()) continue;

    const numeroLinea = i + 1;
    const [referencia, nombre, descripcion, categoria, stock, p1, p3, p6] =
      dividirLinea(linea);

    if (!referencia) {
      errores.push(`línea ${numeroLinea}: falta la referencia`);
      continue;
    }
    if (!nombre) {
      errores.push(`línea ${numeroLinea} (${referencia}): falta el nombre`);
      continue;
    }

    const precio1 = aNumero(p1);
    if (precio1 <= 0) {
      errores.push(
        `línea ${numeroLinea} (${referencia}): falta precio_1, el precio de 1 unidad`
      );
      continue;
    }

    const escalones = [{ minCantidad: 1, precioUnitario: precio1 }];

    const precio3 = aNumero(p3);
    if (precio3 > 0) escalones.push({ minCantidad: 3, precioUnitario: precio3 });

    const precio6 = aNumero(p6);
    if (precio6 > 0) escalones.push({ minCantidad: 6, precioUnitario: precio6 });

    filas.push({
      referencia: referencia.toUpperCase(),
      nombre,
      descripcion: descripcion ?? "",
      categoria: categoria ?? "",
      stock: aNumero(stock),
      escalones,
    });
  }

  return { filas, errores };
}
