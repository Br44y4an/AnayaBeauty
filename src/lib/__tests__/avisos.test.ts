import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  avisoActual,
  cerrarAviso,
  mostrarAviso,
  pausarAviso,
  reanudarAviso,
} from "@/lib/avisos";

describe("avisos", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cerrarAviso();
  });

  afterEach(() => {
    cerrarAviso();
    vi.useRealTimers();
  });

  it("mostrarAviso deja el aviso como actual, con un id", () => {
    mostrarAviso({ titulo: "Agregado a tu bolsa", detalle: "3 × Brillo labial" });

    expect(avisoActual()).toMatchObject({ titulo: "Agregado a tu bolsa", detalle: "3 × Brillo labial" });
    expect(avisoActual()?.id).toEqual(expect.any(Number));
  });

  it("un segundo aviso reemplaza al primero", () => {
    mostrarAviso({ titulo: "Agregado a tu bolsa" });
    const primero = avisoActual()?.id;

    mostrarAviso({ titulo: "Quitaste Tono 3" });

    expect(avisoActual()?.titulo).toBe("Quitaste Tono 3");
    expect(avisoActual()?.id).not.toBe(primero);
  });

  it("cerrarAviso lo limpia", () => {
    mostrarAviso({ titulo: "Copiado" });
    cerrarAviso();
    expect(avisoActual()).toBeNull();
  });

  it("se cierra solo a los 5000 ms", () => {
    mostrarAviso({ titulo: "Agregado a tu bolsa" });

    vi.advanceTimersByTime(4999);
    expect(avisoActual()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(avisoActual()).toBeNull();
  });

  it("el reemplazo cuenta sus propios 5000 ms", () => {
    mostrarAviso({ titulo: "Primero" });
    vi.advanceTimersByTime(4000);
    mostrarAviso({ titulo: "Segundo" });

    vi.advanceTimersByTime(4000);
    expect(avisoActual()?.titulo).toBe("Segundo");

    vi.advanceTimersByTime(1000);
    expect(avisoActual()).toBeNull();
  });

  it("pausado no se cierra; al reanudar vuelve a contar 5000 ms", () => {
    mostrarAviso({ titulo: "Quitaste Tono 3" });
    vi.advanceTimersByTime(3000);
    pausarAviso();

    vi.advanceTimersByTime(60_000);
    expect(avisoActual()?.titulo).toBe("Quitaste Tono 3");

    reanudarAviso();
    vi.advanceTimersByTime(4999);
    expect(avisoActual()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(avisoActual()).toBeNull();
  });

  it("con foco y puntero a la vez solo se reanuda cuando terminan las dos pausas", () => {
    mostrarAviso({ titulo: "Quitaste Tono 3" });
    pausarAviso(); // foco
    pausarAviso(); // puntero

    reanudarAviso(); // sale el puntero
    vi.advanceTimersByTime(60_000);
    expect(avisoActual()?.titulo).toBe("Quitaste Tono 3");

    reanudarAviso(); // se va el foco
    vi.advanceTimersByTime(4999);
    expect(avisoActual()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(avisoActual()).toBeNull();
  });

  it("un aviso nuevo empieza sin las pausas del anterior", () => {
    mostrarAviso({ titulo: "Agregado a tu bolsa" });
    pausarAviso();

    mostrarAviso({ titulo: "Copiado" });
    vi.advanceTimersByTime(5000);

    expect(avisoActual()).toBeNull();
  });

  it("reanudar sin una pausa activa no descuadra la cuenta", () => {
    mostrarAviso({ titulo: "Copiado" });
    reanudarAviso();
    reanudarAviso();

    pausarAviso();
    vi.advanceTimersByTime(60_000);
    expect(avisoActual()).not.toBeNull();

    reanudarAviso();
    vi.advanceTimersByTime(5000);
    expect(avisoActual()).toBeNull();
  });
});
