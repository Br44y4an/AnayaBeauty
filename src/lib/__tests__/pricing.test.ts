import { describe, it, expect } from "vitest";
import {
  precioUnitarioPara,
  subtotalPara,
  precioDesde,
  sugerenciaUpsell,
  type Escalon,
} from "@/lib/pricing";

// El ejemplo real del negocio: 1 a $10.000, 3 a $9.000, 6 a $8.000
const labial: Escalon[] = [
  { minCantidad: 1, precioUnitario: 10000 },
  { minCantidad: 3, precioUnitario: 9000 },
  { minCantidad: 6, precioUnitario: 8000 },
];

// Escalones desordenados a propósito: el motor no puede asumir orden
const desordenado: Escalon[] = [
  { minCantidad: 6, precioUnitario: 8000 },
  { minCantidad: 1, precioUnitario: 10000 },
  { minCantidad: 3, precioUnitario: 9000 },
];

const unicoEscalon: Escalon[] = [{ minCantidad: 1, precioUnitario: 12000 }];

describe("precioUnitarioPara", () => {
  it("aplica el primer escalón para 1 y 2 unidades", () => {
    expect(precioUnitarioPara(labial, 1)).toBe(10000);
    expect(precioUnitarioPara(labial, 2)).toBe(10000);
  });

  it("aplica el segundo escalón desde 3 y hasta 5 unidades", () => {
    expect(precioUnitarioPara(labial, 3)).toBe(9000);
    expect(precioUnitarioPara(labial, 4)).toBe(9000);
    expect(precioUnitarioPara(labial, 5)).toBe(9000);
  });

  it("aplica el tercer escalón desde 6 unidades en adelante", () => {
    expect(precioUnitarioPara(labial, 6)).toBe(8000);
    expect(precioUnitarioPara(labial, 7)).toBe(8000);
    expect(precioUnitarioPara(labial, 50)).toBe(8000);
  });

  it("no depende del orden en que vengan los escalones", () => {
    expect(precioUnitarioPara(desordenado, 4)).toBe(9000);
    expect(precioUnitarioPara(desordenado, 6)).toBe(8000);
  });

  it("usa el escalón más bajo si la cantidad queda por debajo del mínimo", () => {
    const sinEscalonDeUno: Escalon[] = [{ minCantidad: 3, precioUnitario: 9000 }];
    expect(precioUnitarioPara(sinEscalonDeUno, 1)).toBe(9000);
  });

  it("lanza error si no hay escalones", () => {
    expect(() => precioUnitarioPara([], 1)).toThrow("sin escalones");
  });

  it("lanza error si la cantidad no es un entero positivo", () => {
    expect(() => precioUnitarioPara(labial, 0)).toThrow("cantidad");
    expect(() => precioUnitarioPara(labial, -2)).toThrow("cantidad");
    expect(() => precioUnitarioPara(labial, 1.5)).toThrow("cantidad");
  });
});

describe("subtotalPara", () => {
  it("reproduce la tabla completa del negocio", () => {
    expect(subtotalPara(labial, 1)).toBe(10000);
    expect(subtotalPara(labial, 2)).toBe(20000);
    expect(subtotalPara(labial, 3)).toBe(27000);
    expect(subtotalPara(labial, 4)).toBe(36000);
    expect(subtotalPara(labial, 5)).toBe(45000);
    expect(subtotalPara(labial, 6)).toBe(48000);
    expect(subtotalPara(labial, 7)).toBe(56000);
  });

  it("devuelve siempre un entero", () => {
    expect(Number.isInteger(subtotalPara(labial, 7))).toBe(true);
  });
});

describe("precioDesde", () => {
  it("devuelve el precio unitario más bajo disponible", () => {
    expect(precioDesde(labial)).toBe(8000);
    expect(precioDesde(unicoEscalon)).toBe(12000);
  });
});

describe("sugerenciaUpsell", () => {
  it("con 2 unidades sugiere llegar a 3 y calcula el ahorro real", () => {
    // A precio actual, 3 unidades costarían 30.000; con el escalón cuestan 27.000
    expect(sugerenciaUpsell(labial, 2)).toEqual({
      unidadesFaltantes: 1,
      nuevaCantidad: 3,
      nuevoPrecioUnitario: 9000,
      ahorro: 3000,
    });
  });

  it("con 5 unidades sugiere llegar a 6", () => {
    // A precio actual, 6 unidades costarían 54.000; con el escalón cuestan 48.000
    expect(sugerenciaUpsell(labial, 5)).toEqual({
      unidadesFaltantes: 1,
      nuevaCantidad: 6,
      nuevoPrecioUnitario: 8000,
      ahorro: 6000,
    });
  });

  it("con 1 unidad sugiere el siguiente escalón, no el último", () => {
    const sugerencia = sugerenciaUpsell(labial, 1);
    expect(sugerencia?.nuevaCantidad).toBe(3);
    expect(sugerencia?.unidadesFaltantes).toBe(2);
  });

  it("no sugiere nada cuando ya está en el escalón más alto", () => {
    expect(sugerenciaUpsell(labial, 6)).toBeNull();
    expect(sugerenciaUpsell(labial, 20)).toBeNull();
  });

  it("no sugiere nada cuando el producto tiene un solo escalón", () => {
    expect(sugerenciaUpsell(unicoEscalon, 1)).toBeNull();
  });
});
