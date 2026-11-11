import { describe, it, expect } from "vitest";
import { resumenDeCompra } from "@/lib/compra";

const escalones = [
  { minCantidad: 1, precioUnitario: 8000 },
  { minCantidad: 3, precioUnitario: 7500 },
  { minCantidad: 6, precioUnitario: 6500 },
];

describe("resumenDeCompra", () => {
  it("cobra lo nuevo al escalón que alcanza junto con lo que ya está en la bolsa", () => {
    const r = resumenDeCompra({ escalones, stock: 10, unidadesEnBolsa: 1, unidadesNuevas: 2 });

    expect(r).toEqual({
      unidadesEnBolsa: 1,
      unidadesNuevas: 2,
      unidadesTotales: 3,
      precioUnitario: 7500,
      subtotalNuevas: 15000,
      escalonActivo: { minCantidad: 3, precioUnitario: 7500 },
      siguiente: { faltan: 3, precioUnitario: 6500 },
      maxNuevas: 9,
      bloqueo: null,
    });
  });

  it("pide elegir algo cuando no hay unidades nuevas", () => {
    const r = resumenDeCompra({ escalones, stock: 10, unidadesEnBolsa: 0, unidadesNuevas: 0 });

    expect(r.bloqueo).toBe("sin-seleccion");
    expect(r.subtotalNuevas).toBe(0);
    // Sin nada elegido se muestra el precio de una unidad, no $0.
    expect(r.precioUnitario).toBe(8000);
  });

  it("bloquea un producto agotado", () => {
    const r = resumenDeCompra({ escalones, stock: 0, unidadesEnBolsa: 0, unidadesNuevas: 1 });

    expect(r.bloqueo).toBe("agotado");
    expect(r.maxNuevas).toBe(0);
  });

  it("bloquea un producto sin precio sin inventar uno", () => {
    const r = resumenDeCompra({ escalones: [], stock: 10, unidadesEnBolsa: 0, unidadesNuevas: 1 });

    expect(r.bloqueo).toBe("sin-precio");
    expect(r.escalonActivo).toBeNull();
    expect(r.siguiente).toBeNull();
    expect(r.subtotalNuevas).toBe(0);
  });

  it("no deja pasar del stock contando lo que ya está en la bolsa", () => {
    const r = resumenDeCompra({ escalones, stock: 10, unidadesEnBolsa: 8, unidadesNuevas: 3 });

    expect(r.bloqueo).toBe("supera-stock");
    expect(r.maxNuevas).toBe(2);
  });

  it("no promete un escalón que el stock no alcanza", () => {
    const alcanzable = resumenDeCompra({ escalones, stock: 5, unidadesEnBolsa: 0, unidadesNuevas: 1 });
    const inalcanzable = resumenDeCompra({ escalones, stock: 4, unidadesEnBolsa: 3, unidadesNuevas: 1 });

    expect(alcanzable.siguiente).toEqual({ faltan: 2, precioUnitario: 7500 });
    expect(inalcanzable.siguiente).toBeNull();
  });

  it("no hay siguiente escalón cuando ya está en el último", () => {
    const r = resumenDeCompra({ escalones, stock: 10, unidadesEnBolsa: 0, unidadesNuevas: 6 });

    expect(r.precioUnitario).toBe(6500);
    expect(r.subtotalNuevas).toBe(39000);
    expect(r.siguiente).toBeNull();
  });

  it("no depende del orden en que llegan los escalones", () => {
    const desordenados = [escalones[2], escalones[0], escalones[1]];
    const r = resumenDeCompra({
      escalones: desordenados,
      stock: 10,
      unidadesEnBolsa: 1,
      unidadesNuevas: 2,
    });

    expect(r.precioUnitario).toBe(7500);
    expect(r.siguiente).toEqual({ faltan: 3, precioUnitario: 6500 });
  });
});
