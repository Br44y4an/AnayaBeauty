import { describe, it, expect } from "vitest";
import { fechaCorta, fechaHora, pesos } from "@/lib/format";

describe("pesos", () => {
  it("formatea con punto de miles y sin decimales", () => {
    expect(pesos(27000)).toBe("$27.000");
    expect(pesos(8000)).toBe("$8.000");
    expect(pesos(1250000)).toBe("$1.250.000");
  });

  it("maneja el cero", () => {
    expect(pesos(0)).toBe("$0");
  });

  it("redondea valores no enteros en vez de mostrar decimales", () => {
    expect(pesos(9999.6)).toBe("$10.000");
  });
});

/** Bogotá es UTC−5 todo el año: 01:42 UTC del 11 son las 8:42 p. m. del 10. */
describe("fechas en hora de Bogotá", () => {
  it("fechaCorta da día y mes abreviado del día de Bogotá", () => {
    expect(fechaCorta("2026-11-11T01:42:00Z")).toBe("10 nov");
  });

  it("fechaHora da la hora de 12 horas con a. m. y p. m.", () => {
    expect(fechaHora("2026-11-11T01:42:00Z")).toBe("10 nov, 8:42 p. m.");
    expect(fechaHora("2026-11-10T14:05:00Z")).toBe("10 nov, 9:05 a. m.");
  });

  it("medianoche y mediodía son las 12", () => {
    expect(fechaHora("2026-11-10T05:00:00Z")).toBe("10 nov, 12:00 a. m.");
    expect(fechaHora("2026-11-10T17:30:00Z")).toBe("10 nov, 12:30 p. m.");
  });

  it("una fecha inválida no se pinta como «Invalid Date»", () => {
    expect(fechaCorta("no es una fecha")).toBe("");
    expect(fechaHora("")).toBe("");
  });
});
