import { describe, it, expect } from "vitest";
import { parsearCSV } from "@/lib/csv";

const cabecera = "referencia,nombre,descripcion,categoria,stock,precio_1,precio_3,precio_6";

describe("parsearCSV", () => {
  it("lee una fila completa con sus tres escalones", () => {
    const { filas, errores } = parsearCSV(
      `${cabecera}\nREF-101,Labial Rojo,Mate,Labiales,12,10000,9000,8000`
    );

    expect(errores).toEqual([]);
    expect(filas).toHaveLength(1);
    expect(filas[0].referencia).toBe("REF-101");
    expect(filas[0].stock).toBe(12);
    expect(filas[0].escalones).toEqual([
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ]);
  });

  it("acepta filas con un solo precio", () => {
    const { filas } = parsearCSV(`${cabecera}\nREF-200,Brocha,,Accesorios,5,15000,,`);
    expect(filas[0].escalones).toEqual([{ minCantidad: 1, precioUnitario: 15000 }]);
  });

  it("rechaza filas sin referencia y dice en qué línea", () => {
    const { filas, errores } = parsearCSV(`${cabecera}\n,Sin referencia,,Labiales,5,10000,,`);
    expect(filas).toHaveLength(0);
    expect(errores[0]).toContain("línea 2");
  });

  it("rechaza filas sin precio para 1 unidad", () => {
    const { errores } = parsearCSV(`${cabecera}\nREF-300,Rubor,,Rubores,5,,9000,`);
    expect(errores[0]).toContain("precio_1");
  });

  it("ignora líneas en blanco", () => {
    const { filas, errores } = parsearCSV(
      `${cabecera}\nREF-101,Labial,,Labiales,1,10000,,\n\n   \n`
    );
    expect(filas).toHaveLength(1);
    expect(errores).toEqual([]);
  });

  it("respeta las comas dentro de comillas", () => {
    const { filas } = parsearCSV(
      `${cabecera}\nREF-400,"Base mate, tono 2",Cobertura alta,Bases,3,35000,,`
    );
    expect(filas[0].nombre).toBe("Base mate, tono 2");
  });

  it("pasa la referencia a mayúsculas", () => {
    const { filas } = parsearCSV(`${cabecera}\nref-500,Sombra,,Ojos,4,20000,,`);
    expect(filas[0].referencia).toBe("REF-500");
  });

  it("tolera separadores de miles con punto en los precios", () => {
    const { filas } = parsearCSV(`${cabecera}\nREF-600,Base,,Rostro,2,"35.000",,`);
    expect(filas[0].escalones[0].precioUnitario).toBe(35000);
  });

  it("acepta archivos con saltos de línea de Windows", () => {
    const { filas, errores } = parsearCSV(
      `${cabecera}\r\nREF-101,Labial,,Labiales,3,10000,,\r\n`
    );
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(1);
    expect(filas[0].stock).toBe(3);
  });
});
