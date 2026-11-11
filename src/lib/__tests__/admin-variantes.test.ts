import { describe, it, expect } from "vitest";
import {
  diffVariantes,
  requiereDosPasos,
  validarVariantes,
  type VarianteEditable,
} from "@/lib/admin/variantes";
import type { Variante } from "@/lib/types";

const ACTUALES: Variante[] = [
  { id: "v1", nombre: "Tono 1", colorHex: "#aa0000", orden: 0, agotado: false },
  { id: "v2", nombre: "Tono 2", colorHex: "#00aa00", orden: 1, agotado: false },
  { id: "v3", nombre: "Tono 3", colorHex: "#0000aa", orden: 2, agotado: false },
];

const editable = ({ id, nombre, colorHex, agotado }: Variante): VarianteEditable => ({
  id,
  nombre,
  colorHex,
  agotado,
});

describe("diffVariantes", () => {
  it("sin cambios no escribe nada", () => {
    expect(diffVariantes(ACTUALES, ACTUALES.map(editable))).toEqual({
      insertar: [],
      actualizar: [],
      borrar: [],
    });
  });

  it("una existente renombrada se actualiza con el mismo id", () => {
    const nuevas = ACTUALES.map(editable);
    nuevas[1] = { ...nuevas[1], nombre: "Rosa viejo" };

    const diff = diffVariantes(ACTUALES, nuevas);
    expect(diff.actualizar).toEqual([
      { id: "v2", nombre: "Rosa viejo", colorHex: "#00aa00", orden: 1, agotado: false },
    ]);
    expect(diff.insertar).toEqual([]);
    expect(diff.borrar).toEqual([]);
  });

  it("una quitada va a borrar y las de después suben de posición", () => {
    const diff = diffVariantes(ACTUALES, [editable(ACTUALES[0]), editable(ACTUALES[2])]);
    expect(diff.borrar).toEqual(["v2"]);
    expect(diff.actualizar).toEqual([{ ...ACTUALES[2], orden: 1 }]);
    expect(diff.insertar).toEqual([]);
  });

  it("una nueva sin id se inserta con el orden de su posición", () => {
    const nueva: VarianteEditable = { id: null, nombre: "Tono 4", colorHex: "#e5308a", agotado: false };
    const diff = diffVariantes(ACTUALES, [...ACTUALES.map(editable), nueva]);
    expect(diff.insertar).toEqual([{ nombre: "Tono 4", colorHex: "#e5308a", orden: 3, agotado: false }]);
    expect(diff.actualizar).toEqual([]);
    expect(diff.borrar).toEqual([]);
  });

  it("reordenar cambia el orden sin borrar ni insertar", () => {
    const [a, b, c] = ACTUALES.map(editable);
    const diff = diffVariantes(ACTUALES, [c, a, b]);
    expect(diff.borrar).toEqual([]);
    expect(diff.insertar).toEqual([]);
    expect(diff.actualizar).toEqual([
      { ...ACTUALES[2], orden: 0 },
      { ...ACTUALES[0], orden: 1 },
      { ...ACTUALES[1], orden: 2 },
    ]);
  });

  it("marcar una como agotada actualiza solo esa", () => {
    const nuevas = ACTUALES.map(editable);
    nuevas[0] = { ...nuevas[0], agotado: true };
    expect(diffVariantes(ACTUALES, nuevas).actualizar).toEqual([{ ...ACTUALES[0], agotado: true }]);
  });

  it("no cuenta como cambio un color que solo difiere en mayúsculas", () => {
    const nuevas = ACTUALES.map(editable);
    nuevas[0] = { ...nuevas[0], colorHex: "#AA0000" };
    expect(diffVariantes(ACTUALES, nuevas).actualizar).toEqual([]);
  });

  it("normaliza un orden guardado con huecos a la posición", () => {
    const conHuecos = ACTUALES.map((v, i) => ({ ...v, orden: i * 10 }));
    const diff = diffVariantes(conHuecos, conHuecos.map(editable));
    expect(diff.actualizar.map((v) => [v.id, v.orden])).toEqual([
      ["v2", 1],
      ["v3", 2],
    ]);
  });

  it("un id que ya no existe se inserta como nueva", () => {
    const fantasma: VarianteEditable = { id: "borrada", nombre: "Coral", colorHex: "#ff7f50", agotado: false };
    const diff = diffVariantes(ACTUALES, [...ACTUALES.map(editable), fantasma]);
    expect(diff.insertar).toEqual([{ nombre: "Coral", colorHex: "#ff7f50", orden: 3, agotado: false }]);
  });

  it("un id repetido solo actualiza una fila; la otra se inserta", () => {
    const repetida = { ...editable(ACTUALES[0]), nombre: "Tono 1 bis" };
    const diff = diffVariantes(ACTUALES, [...ACTUALES.map(editable), repetida]);
    expect(diff.insertar).toEqual([{ nombre: "Tono 1 bis", colorHex: "#aa0000", orden: 3, agotado: false }]);
    expect(diff.actualizar).toEqual([]);
  });

  it("quitar todas las borra todas", () => {
    expect(diffVariantes(ACTUALES, [])).toEqual({ insertar: [], actualizar: [], borrar: ["v1", "v2", "v3"] });
  });
});

describe("requiereDosPasos", () => {
  it("intercambiar dos nombres necesita nombres temporales", () => {
    const [a, b, c] = ACTUALES.map(editable);
    const diff = diffVariantes(ACTUALES, [{ ...a, nombre: "Tono 2" }, { ...b, nombre: "Tono 1" }, c]);
    expect(requiereDosPasos(ACTUALES, diff)).toBe(true);
  });

  it("renombrar a un nombre libre se hace en un paso", () => {
    const [a, b, c] = ACTUALES.map(editable);
    const diff = diffVariantes(ACTUALES, [{ ...a, nombre: "Cereza" }, b, c]);
    expect(requiereDosPasos(ACTUALES, diff)).toBe(false);
  });

  it("tomar el nombre de una que se borra no choca: se borra antes", () => {
    const [a, , c] = ACTUALES.map(editable);
    const diff = diffVariantes(ACTUALES, [{ ...a, nombre: "Tono 2" }, c]);
    expect(requiereDosPasos(ACTUALES, diff)).toBe(false);
  });

  it("solo reordenar no necesita nombres temporales", () => {
    const [a, b, c] = ACTUALES.map(editable);
    expect(requiereDosPasos(ACTUALES, diffVariantes(ACTUALES, [c, b, a]))).toBe(false);
  });
});

describe("validarVariantes", () => {
  const fila = (nombre: string, extra: Partial<VarianteEditable> = {}): VarianteEditable => ({
    id: null,
    nombre,
    colorHex: "#e5308a",
    agotado: false,
    ...extra,
  });

  it("limpia espacios y pasa el color a minúsculas", () => {
    expect(validarVariantes([fila("  Rojo   pasión "), fila("Nude", { colorHex: "#C08A7A" })], "Tono")).toEqual({
      ok: true,
      variantes: [fila("Rojo pasión"), fila("Nude", { colorHex: "#c08a7a" })],
    });
  });

  it("descarta las filas nuevas que quedaron en blanco", () => {
    expect(validarVariantes([fila("Rojo"), fila("   ")], "Tono")).toEqual({ ok: true, variantes: [fila("Rojo")] });
  });

  it("rechaza dejar sin nombre una variante que ya existía", () => {
    const resultado = validarVariantes([fila("Rojo"), fila(" ", { id: "v1" })], "Color");
    expect(resultado).toEqual({ ok: false, error: "Falta el nombre en la fila 2. Escríbelo o quita la fila." });
  });

  it("rechaza dos nombres iguales sin distinguir mayúsculas ni tildes", () => {
    expect(validarVariantes([fila("Rosa"), fila("rosa ")], "Tono")).toEqual({
      ok: false,
      error: "Dos tonos tienen el mismo nombre: «rosa». Cambia uno.",
    });
    expect(validarVariantes([fila("Café"), fila("cafe")], "Paleta").ok).toBe(false);
  });

  it("rechaza un color mal escrito", () => {
    expect(validarVariantes([fila("Rojo", { colorHex: "rojo" })], "Tono")).toEqual({
      ok: false,
      error: "El color de «Rojo» no es válido.",
    });
  });

  it("rechaza nombres demasiado largos", () => {
    expect(validarVariantes([fila("x".repeat(61))], "Diseño").ok).toBe(false);
  });

  it("rechaza más variantes de las que caben", () => {
    const muchas = Array.from({ length: 101 }, (_, i) => fila(`Tono ${i + 1}`));
    expect(validarVariantes(muchas, "Paleta")).toEqual({ ok: false, error: "Puedes cargar hasta 100 paletas." });
  });
});
