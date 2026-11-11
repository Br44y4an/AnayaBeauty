// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  CLAVE_CARRITO,
  escucharOtrasPestanas,
  totalUnidades,
  unidadesDeProducto,
  useCarrito,
  useLineasDeProducto,
  useTotalUnidades,
  useUnidadesDeProducto,
} from "@/lib/cart";

const CEREZA = { id: "t1", nombre: "Cereza" };
const VINO = { id: "t2", nombre: "Vino" };

beforeEach(() => useCarrito.getState().vaciar());
afterEach(() => vi.restoreAllMocks());

describe("carrito", () => {
  it("agrega un producto sin tono", () => {
    useCarrito.getState().agregar("p1", 2);
    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 2 },
    ]);
  });

  it("suma la cantidad si el producto y el tono coinciden", () => {
    useCarrito.getState().agregar("p1", 2, CEREZA);
    useCarrito.getState().agregar("p1", 3, CEREZA);
    expect(useCarrito.getState().lineas).toHaveLength(1);
    expect(useCarrito.getState().lineas[0].cantidad).toBe(5);
  });

  it("separa en líneas distintas dos tonos del mismo producto", () => {
    useCarrito.getState().agregar("p1", 2, CEREZA);
    useCarrito.getState().agregar("p1", 1, VINO);

    const lineas = useCarrito.getState().lineas;
    expect(lineas).toHaveLength(2);
    expect(lineas[0].tonoNombre).toBe("Cereza");
    expect(lineas[1].tonoNombre).toBe("Vino");
  });

  it("no confunde el producto sin tono con el mismo producto con tono", () => {
    useCarrito.getState().agregar("p1", 1);
    useCarrito.getState().agregar("p1", 1, CEREZA);
    expect(useCarrito.getState().lineas).toHaveLength(2);
  });

  it("establece la cantidad de un tono concreto", () => {
    useCarrito.getState().agregar("p1", 5, CEREZA);
    useCarrito.getState().agregar("p1", 5, VINO);
    useCarrito.getState().establecer("p1", "t1", 2);

    const lineas = useCarrito.getState().lineas;
    expect(lineas.find((l) => l.tonoId === "t1")?.cantidad).toBe(2);
    expect(lineas.find((l) => l.tonoId === "t2")?.cantidad).toBe(5);
  });

  it("elimina la línea si la cantidad baja a cero", () => {
    useCarrito.getState().agregar("p1", 3, CEREZA);
    useCarrito.getState().establecer("p1", "t1", 0);
    expect(useCarrito.getState().lineas).toEqual([]);
  });

  it("quita solo el tono indicado", () => {
    useCarrito.getState().agregar("p1", 1, CEREZA);
    useCarrito.getState().agregar("p1", 1, VINO);
    useCarrito.getState().quitar("p1", "t1");

    expect(useCarrito.getState().lineas).toHaveLength(1);
    expect(useCarrito.getState().lineas[0].tonoId).toBe("t2");
  });

  it("cuenta el total de unidades sumando todas las líneas", () => {
    useCarrito.getState().agregar("p1", 3, CEREZA);
    useCarrito.getState().agregar("p2", 4);
    expect(totalUnidades(useCarrito.getState())).toBe(7);
  });

  it("suma las unidades de un producto a través de sus tonos", () => {
    useCarrito.getState().agregar("p1", 3, CEREZA);
    useCarrito.getState().agregar("p1", 2, VINO);
    useCarrito.getState().agregar("p2", 9);

    // Importante para el stock: los tonos comparten inventario
    expect(unidadesDeProducto(useCarrito.getState(), "p1")).toBe(5);
  });

  it("vaciar borra las líneas y la clave de envío", () => {
    useCarrito.getState().agregar("p1", 1, CEREZA);
    useCarrito.getState().prepararEnvio();
    useCarrito.getState().vaciar();

    expect(useCarrito.getState().lineas).toEqual([]);
    expect(useCarrito.getState().claveEnvio).toBeNull();
  });
});

describe("restaurar (deshacer)", () => {
  it("devuelve la línea quitada a su posición", () => {
    useCarrito.getState().agregar("p1", 2, CEREZA);
    useCarrito.getState().agregar("p2", 1);
    useCarrito.getState().agregar("p3", 1);
    const quitada = useCarrito.getState().lineas[0];

    useCarrito.getState().quitar("p1", "t1");
    useCarrito.getState().restaurar(quitada, 0);

    expect(useCarrito.getState().lineas.map((l) => l.productoId)).toEqual(["p1", "p2", "p3"]);
    expect(useCarrito.getState().lineas[0]).toEqual(quitada);
  });

  it("devuelve una línea del medio a su sitio", () => {
    useCarrito.getState().agregar("p1", 1);
    useCarrito.getState().agregar("p2", 1);
    useCarrito.getState().agregar("p3", 1);
    const quitada = useCarrito.getState().lineas[1];

    useCarrito.getState().quitar("p2", null);
    useCarrito.getState().restaurar(quitada, 1);

    expect(useCarrito.getState().lineas.map((l) => l.productoId)).toEqual(["p1", "p2", "p3"]);
  });

  it("no duplica una línea que la clienta ya volvió a agregar", () => {
    useCarrito.getState().agregar("p1", 2, CEREZA);
    const quitada = useCarrito.getState().lineas[0];
    useCarrito.getState().quitar("p1", "t1");
    useCarrito.getState().agregar("p1", 1, CEREZA);

    useCarrito.getState().restaurar(quitada, 0);

    expect(useCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: "t1", tonoNombre: "Cereza", cantidad: 1 },
    ]);
  });

  it("deshacer también cambia la bolsa: invalida la clave de envío", () => {
    useCarrito.getState().agregar("p1", 1);
    const quitada = useCarrito.getState().lineas[0];
    useCarrito.getState().quitar("p1", null);
    useCarrito.getState().prepararEnvio();

    useCarrito.getState().restaurar(quitada, 0);
    expect(useCarrito.getState().claveEnvio).toBeNull();
  });
});

describe("clave de envío (reintento seguro)", () => {
  it("devuelve la MISMA clave mientras la bolsa no cambie", () => {
    // Es lo que hace que un doble toque en "Confirmar" no cree dos
    // pedidos: la segunda llamada llega con la misma clave.
    useCarrito.getState().agregar("p1", 1, CEREZA);

    const primera = useCarrito.getState().prepararEnvio();
    const segunda = useCarrito.getState().prepararEnvio();

    expect(primera).toBe(segunda);
    expect(primera).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("renueva la clave en cuanto la bolsa cambia", () => {
    useCarrito.getState().agregar("p1", 1, CEREZA);
    const primera = useCarrito.getState().prepararEnvio();

    useCarrito.getState().agregar("p2", 1);
    expect(useCarrito.getState().claveEnvio).toBeNull();

    const segunda = useCarrito.getState().prepararEnvio();
    expect(segunda).not.toBe(primera);
  });

  it("también se renueva al cambiar cantidades o quitar líneas", () => {
    useCarrito.getState().agregar("p1", 2, CEREZA);

    useCarrito.getState().prepararEnvio();
    useCarrito.getState().establecer("p1", "t1", 3);
    expect(useCarrito.getState().claveEnvio).toBeNull();

    useCarrito.getState().prepararEnvio();
    useCarrito.getState().quitar("p1", "t1");
    expect(useCarrito.getState().claveEnvio).toBeNull();
  });
});

describe("identidad de las líneas (rendimiento)", () => {
  it("conserva la referencia de las líneas que no se tocan", () => {
    // De esto depende que la tarjeta de un producto NO se vuelva a
    // pintar cuando cambia otro: useShallow compara por referencia.
    useCarrito.getState().agregar("p1", 1, CEREZA);
    useCarrito.getState().agregar("p2", 1);

    const antes = useCarrito.getState().lineas.find((l) => l.productoId === "p2");
    useCarrito.getState().establecer("p1", "t1", 5);
    const despues = useCarrito.getState().lineas.find((l) => l.productoId === "p2");

    expect(despues).toBe(antes);
  });

  it("ignora cantidades inválidas", () => {
    useCarrito.getState().agregar("p1", 0, CEREZA);
    useCarrito.getState().agregar("p2", -3);
    expect(useCarrito.getState().lineas).toEqual([]);
  });
});

describe("hooks por producto", () => {
  it("cada hook ve solo lo que le toca", () => {
    const lineas = renderHook(() => useLineasDeProducto("p1"));
    const unidades = renderHook(() => useUnidadesDeProducto("p1"));
    const total = renderHook(() => useTotalUnidades());

    act(() => {
      useCarrito.getState().agregar("p1", 2, CEREZA);
      useCarrito.getState().agregar("p1", 1, VINO);
      useCarrito.getState().agregar("p2", 4);
    });

    expect(lineas.result.current.map((l) => l.tonoId)).toEqual(["t1", "t2"]);
    expect(unidades.result.current).toBe(3);
    expect(total.result.current).toBe(7);
  });
});

describe("escucharOtrasPestanas", () => {
  const avisar = (key: string | null) =>
    window.dispatchEvent(new StorageEvent("storage", { key }));

  it("relee la bolsa cuando otra pestaña la cambia, y deja de hacerlo al limpiar", () => {
    const releer = vi.spyOn(useCarrito.persist, "rehydrate").mockResolvedValue();
    const dejar = escucharOtrasPestanas();

    avisar(CLAVE_CARRITO);
    avisar("otra-clave");
    expect(releer).toHaveBeenCalledTimes(1);

    dejar();
    avisar(CLAVE_CARRITO);
    expect(releer).toHaveBeenCalledTimes(1);
  });

  it("trae lo que la otra pestaña agregó en vez de pisarlo", async () => {
    useCarrito.getState().agregar("p1", 1);
    const dejar = escucharOtrasPestanas();

    // La otra pestaña (abierta desde WhatsApp) guardó dos productos.
    const deLaOtra = [
      { productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 1 },
      { productoId: "p9", tonoId: "t9", tonoNombre: "Coral", cantidad: 2 },
    ];
    localStorage.setItem(
      CLAVE_CARRITO,
      JSON.stringify({ state: { lineas: deLaOtra, claveEnvio: null }, version: 3 })
    );
    avisar(CLAVE_CARRITO);

    await vi.waitFor(() => expect(useCarrito.getState().lineas).toEqual(deLaOtra));
    dejar();
  });
});
