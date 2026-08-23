import { describe, it, expect } from "vitest";
import { calcularTotales, type ReglaDescuento, type LineaCalculo } from "@/lib/discounts";
import type { Escalon } from "@/lib/pricing";

const A: Escalon[] = [
  { minCantidad: 1, precioUnitario: 10000 },
  { minCantidad: 3, precioUnitario: 9000 },
  { minCantidad: 6, precioUnitario: 8000 },
];

const B: Escalon[] = [
  { minCantidad: 1, precioUnitario: 20000 },
  { minCantidad: 3, precioUnitario: 18000 },
];

const REGLA_5: ReglaDescuento[] = [{ montoMinimo: 50000, porcentaje: 5 }];

const REGLAS_ESCALONADAS: ReglaDescuento[] = [
  { montoMinimo: 150000, porcentaje: 10 },
  { montoMinimo: 50000, porcentaje: 5 },
];

const UMBRAL = 200000;

const linea = (escalones: Escalon[], cantidad: number): LineaCalculo => ({
  escalones,
  cantidad,
});

describe("calcularTotales — sin beneficios", () => {
  it("cobra el escalón normal cuando no alcanza ningún umbral", () => {
    const t = calcularTotales([linea(A, 1)], REGLA_5, UMBRAL);

    expect(t.subtotalNormal).toBe(10000);
    expect(t.porMayor).toBe(false);
    expect(t.porcentaje).toBe(0);
    expect(t.descuento).toBe(0);
    expect(t.total).toBe(10000);
  });

  it("un carrito vacío da todo en cero", () => {
    const t = calcularTotales([], REGLA_5, UMBRAL);
    expect(t.total).toBe(0);
    expect(t.subtotalNormal).toBe(0);
  });
});

describe("calcularTotales — descuento por porcentaje", () => {
  it("no aplica descuento justo por debajo del mínimo", () => {
    // 6 unidades de A al escalón de 8.000 = 48.000, por debajo de 50.000
    const t = calcularTotales([linea(A, 6)], REGLA_5, UMBRAL);
    expect(t.subtotalBase).toBe(48000);
    expect(t.porcentaje).toBe(0);
    expect(t.total).toBe(48000);
  });

  it("aplica el descuento al alcanzar el mínimo exacto", () => {
    // 5 de A → escalón de 9.000 → 45.000; añadimos B para llegar a 50.000+
    const t = calcularTotales([linea(A, 7)], REGLA_5, UMBRAL);
    // 7 de A al escalón de 8.000 = 56.000
    expect(t.subtotalBase).toBe(56000);
    expect(t.porcentaje).toBe(5);
    expect(t.descuento).toBe(2800);
    expect(t.total).toBe(53200);
  });

  it("elige la regla de mayor monto que el carrito alcanza", () => {
    // 10 de B al escalón de 18.000 = 180.000 → supera 150.000
    const t = calcularTotales([linea(B, 10)], REGLAS_ESCALONADAS, 999999);
    expect(t.subtotalBase).toBe(180000);
    expect(t.porcentaje).toBe(10);
    expect(t.descuento).toBe(18000);
    expect(t.total).toBe(162000);
  });

  it("redondea el descuento al peso", () => {
    const reglas: ReglaDescuento[] = [{ montoMinimo: 1, porcentaje: 5 }];
    const escalon: Escalon[] = [{ minCantidad: 1, precioUnitario: 33333 }];
    const t = calcularTotales([linea(escalon, 1)], reglas, 999999);
    // 33.333 * 5% = 1.666,65 → 1.667
    expect(t.descuento).toBe(1667);
    expect(t.total).toBe(31666);
  });
});

describe("calcularTotales — precio por mayor", () => {
  it("no aplica por mayor por debajo del umbral", () => {
    // 1 de A (10.000) + 10 de B (180.000) = 190.000
    const t = calcularTotales([linea(A, 1), linea(B, 10)], REGLA_5, UMBRAL);
    expect(t.subtotalNormal).toBe(190000);
    expect(t.porMayor).toBe(false);
    expect(t.subtotalBase).toBe(190000);
  });

  it("aplica por mayor al alcanzar el umbral exacto", () => {
    // 2 de A (20.000) + 10 de B (180.000) = 200.000 justo
    const t = calcularTotales([linea(A, 2), linea(B, 10)], [], UMBRAL);

    expect(t.subtotalNormal).toBe(200000);
    expect(t.porMayor).toBe(true);
    // A pasa a 8.000 c/u → 16.000; B ya estaba en su más bajo → 180.000
    expect(t.subtotalBase).toBe(196000);
    expect(t.total).toBe(196000);
  });

  it("NO revierte el por mayor aunque el total quede bajo el umbral", () => {
    // Este es el caso que causaría un bucle infinito si se recalculara:
    // 200.000 activa el por mayor, que baja el total a 196.000.
    const t = calcularTotales([linea(A, 2), linea(B, 10)], [], UMBRAL);

    expect(t.subtotalBase).toBeLessThan(UMBRAL);
    expect(t.porMayor).toBe(true);
  });
});

describe("calcularTotales — cascada completa", () => {
  it("aplica primero el por mayor y luego el porcentaje sobre el resultado", () => {
    const t = calcularTotales([linea(A, 2), linea(B, 10)], REGLAS_ESCALONADAS, UMBRAL);

    expect(t.subtotalNormal).toBe(200000);
    expect(t.porMayor).toBe(true);
    expect(t.subtotalBase).toBe(196000);
    // El porcentaje se evalúa sobre 196.000, no sobre 200.000
    expect(t.porcentaje).toBe(10);
    expect(t.descuento).toBe(19600);
    expect(t.total).toBe(176400);
  });

  it("informa el ahorro total frente al precio sin ningún beneficio", () => {
    const t = calcularTotales([linea(A, 2), linea(B, 10)], REGLAS_ESCALONADAS, UMBRAL);
    // 200.000 normales contra 176.400 finales
    expect(t.ahorroTotal).toBe(23600);
  });
});

describe("calcularTotales — robustez", () => {
  it("ignora líneas sin escalones configurados", () => {
    const t = calcularTotales([linea(A, 1), linea([], 5)], REGLA_5, UMBRAL);
    expect(t.total).toBe(10000);
  });

  it("ignora reglas con porcentaje fuera de rango", () => {
    const reglas: ReglaDescuento[] = [
      { montoMinimo: 1, porcentaje: 0 },
      { montoMinimo: 1, porcentaje: 150 },
    ];
    const t = calcularTotales([linea(A, 1)], reglas, UMBRAL);
    expect(t.porcentaje).toBe(0);
    expect(t.total).toBe(10000);
  });
});
