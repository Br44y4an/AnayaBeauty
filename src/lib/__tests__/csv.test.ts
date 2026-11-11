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

/* Importar sobre productos que ya existen: una celda vacía significa «no tocar». */
describe("parsearCSV con celdas vacías", () => {
  it("deja en null el stock, el nombre, la descripción y la categoría vacíos", () => {
    const { filas, errores } = parsearCSV(`${cabecera}\nREF-101,,,,,10000,,`);
    expect(errores).toEqual([]);
    expect(filas[0]).toEqual({
      linea: 2,
      referencia: "REF-101",
      nombre: null,
      descripcion: null,
      categoria: null,
      stock: null,
      escalones: [{ minCantidad: 1, precioUnitario: 10000 }],
    });
  });

  it("distingue un stock de 0 de un stock vacío", () => {
    const { filas } = parsearCSV(`${cabecera}\nREF-1,Labial,,,0,10000,,\nREF-2,Labial,,,,10000,,`);
    expect(filas.map((f) => f.stock)).toEqual([0, null]);
  });

  it("acepta una fila sin ningún precio: los precios no se tocan", () => {
    const { filas, errores } = parsearCSV(`${cabecera}\nREF-101,,,,7,,,`);
    expect(errores).toEqual([]);
    expect(filas[0].escalones).toEqual([]);
    expect(filas[0].stock).toBe(7);
  });

  it("rechaza un stock que no es un número entero", () => {
    const { filas, errores } = parsearCSV(`${cabecera}\nREF-1,Labial,,,-3,10000,,\nREF-2,Labial,,,mucho,10000,,`);
    expect(filas).toEqual([]);
    expect(errores).toEqual([
      "línea 2 (REF-1): el stock «-3» no es un número entero",
      "línea 3 (REF-2): el stock «mucho» no es un número entero",
    ]);
  });

  it("acepta el punto y coma que usa Excel en español", () => {
    const { filas, errores } = parsearCSV(
      `referencia;nombre;descripcion;categoria;stock;precio_1;precio_3;precio_6\nREF-1;"Base; tono 2";;Rostro;4;35.000;32.000;`
    );
    expect(errores).toEqual([]);
    expect(filas[0].nombre).toBe("Base; tono 2");
    expect(filas[0].escalones).toEqual([
      { minCantidad: 1, precioUnitario: 35000 },
      { minCantidad: 3, precioUnitario: 32000 },
    ]);
  });

  it("ignora la marca BOM que Excel pone al inicio", () => {
    const { filas, errores } = parsearCSV(`﻿${cabecera}\nREF-1,Labial,,,2,10000,,`);
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(1);
  });
});

/* Un archivo con las columnas en otro orden pondría nombres donde van referencias. */
describe("parsearCSV con otra cabecera", () => {
  const ESPERADA = "la primera línea debe tener los títulos referencia, nombre, descripcion, categoria, stock, precio_1, precio_3, precio_6";

  it("no lee nada si los títulos no son los de la plantilla", () => {
    expect(parsearCSV("nombre,referencia,stock\nLabial,REF-1,3")).toEqual({ filas: [], errores: [ESPERADA] });
    expect(parsearCSV("REF-1,Labial,,,2,10000,,")).toEqual({ filas: [], errores: [ESPERADA] });
  });

  it("acepta los títulos con mayúsculas, tildes o espacios", () => {
    const { filas, errores } = parsearCSV(
      "Referencia, Nombre ,Descripción,Categoría,Stock,Precio_1,Precio_3,Precio_6\nREF-1,Labial,,,2,10000,,"
    );
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(1);
  });

  it("un archivo vacío no tiene filas ni errores", () => {
    expect(parsearCSV("")).toEqual({ filas: [], errores: [] });
  });
});
