// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { SincronizarBolsa } from "@/components/tienda/SincronizarBolsa";
import { CLAVE_CARRITO, useCarrito } from "@/lib/cart";

const linea = (productoId: string, cantidad: number) => ({ productoId, tonoId: null, tonoNombre: null, cantidad });

/** Lo que hace la otra pestaña: escribe la bolsa y el navegador avisa a esta con `storage`. */
function otraPestanaGuarda(lineas: ReturnType<typeof linea>[]) {
  const valor = JSON.stringify({ state: { lineas, claveEnvio: null }, version: 3 });
  localStorage.setItem(CLAVE_CARRITO, valor);
  window.dispatchEvent(new StorageEvent("storage", { key: CLAVE_CARRITO, newValue: valor }));
}

describe("SincronizarBolsa", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useCarrito.setState({ lineas: [], claveEnvio: null }));
  });

  it("trae lo que otra pestaña agregó, sin que esta lo pise", async () => {
    render(<SincronizarBolsa />);

    act(() => otraPestanaGuarda([linea("p1", 2), linea("p2", 1)]));

    await waitFor(() => expect(useCarrito.getState().lineas).toHaveLength(2));
    expect(useCarrito.getState().lineas[0]).toMatchObject({ productoId: "p1", cantidad: 2 });
  });

  it("ignora los cambios de otras claves", async () => {
    render(<SincronizarBolsa />);
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify({ state: { lineas: [linea("p1", 5)] }, version: 3 }));

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "anaya-pedidos", newValue: "[]" }));
    });

    await Promise.resolve();
    expect(useCarrito.getState().lineas).toEqual([]);
  });

  it("deja de escuchar al desmontarse", async () => {
    const { unmount } = render(<SincronizarBolsa />);
    unmount();

    act(() => otraPestanaGuarda([linea("p1", 1)]));

    await Promise.resolve();
    expect(useCarrito.getState().lineas).toEqual([]);
  });
});
