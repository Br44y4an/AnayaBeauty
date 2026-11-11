// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistorialHoja } from "@/hooks/useHistorialHoja";

function montar(alCerrar = vi.fn()) {
  const hook = renderHook(({ abierta }) => useHistorialHoja(abierta, alCerrar), {
    initialProps: { abierta: false },
  });
  return { ...hook, alCerrar };
}

describe("useHistorialHoja", () => {
  beforeEach(() => window.history.replaceState(null, ""));
  afterEach(() => vi.restoreAllMocks());

  it("al abrir agrega una entrada al historial, en la misma URL", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { rerender } = montar();
    expect(pushState).not.toHaveBeenCalled();

    rerender({ abierta: true });

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState.mock.calls[0][2]).toBeUndefined();
  });

  it("cerrar() dos veces seguidas hace un único history.back()", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result, rerender, alCerrar } = montar();
    rerender({ abierta: true });

    act(() => {
      result.current.cerrar();
      result.current.cerrar();
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it("un popstate (el botón Atrás) llama alCerrar", () => {
    const { rerender, alCerrar } = montar();
    rerender({ abierta: true });

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("cerrar() y luego el popstate cierran una sola vez", () => {
    vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    const { result, rerender, alCerrar } = montar();
    rerender({ abierta: true });

    act(() => result.current.cerrar());
    act(() => result.current.cerrar());

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("si la hoja se cierra por otro camino, retira su entrada con un solo back()", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender, alCerrar } = montar();
    rerender({ abierta: true });

    rerender({ abierta: false });

    expect(back).toHaveBeenCalledTimes(1);
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it("si ya no está en su entrada (se navegó con replace), cerrar() no toca el historial", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result, rerender, alCerrar } = montar();
    rerender({ abierta: true });
    window.history.replaceState({ otra: true }, "");

    act(() => result.current.cerrar());

    expect(back).not.toHaveBeenCalled();
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});
