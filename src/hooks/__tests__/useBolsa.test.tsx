// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBolsa } from "@/hooks/useBolsa";
import { useCarrito } from "@/lib/cart";
import type { DatosBolsa } from "@/lib/types";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";

const DATOS: DatosBolsa = {
  productos: [
    {
      id: ID_A,
      referencia: "GLS735",
      nombre: "Brillo labial",
      imagenPrincipal: null,
      stock: 10,
      activo: true,
      escalones: [
        { minCantidad: 1, precioUnitario: 8000 },
        { minCantidad: 3, precioUnitario: 7500 },
      ],
      etiquetaVariante: "Tono",
      variantes: [
        { id: "t1", nombre: "Tono 1", colorHex: "#d3656e", orden: 1, agotado: false },
        { id: "t3", nombre: "Tono 3", colorHex: "#fd909f", orden: 3, agotado: false },
      ],
    },
    {
      id: ID_B,
      referencia: "BRI-52",
      nombre: "Brocha para polvo",
      imagenPrincipal: null,
      stock: 10,
      activo: true,
      escalones: [{ minCantidad: 1, precioUnitario: 16000 }],
      etiquetaVariante: "Color",
      variantes: [],
    },
  ],
  reglas: [{ montoMinimo: 50000, porcentaje: 5 }],
  umbralPorMayor: 200000,
};

const respuesta = (datos: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => datos });

let pedir: Mock;

beforeEach(() => {
  useCarrito.getState().vaciar();
  pedir = vi.fn(async () => respuesta(DATOS));
  vi.stubGlobal("fetch", pedir);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function llenarBolsa() {
  const { agregar } = useCarrito.getState();
  agregar(ID_A, 2, { id: "t1", nombre: "Tono 1" });
  agregar(ID_A, 1, { id: "t3", nombre: "Tono 3" });
  agregar(ID_B, 1);
}

describe("useBolsa", () => {
  it("no pide nada mientras la bolsa del navegador no se ha hidratado", async () => {
    let terminar: () => void = () => {};
    const hidratada = vi.spyOn(useCarrito.persist, "hasHydrated").mockReturnValue(false);
    vi.spyOn(useCarrito.persist, "onFinishHydration").mockImplementation((alTerminar) => {
      terminar = () => alTerminar(useCarrito.getState());
      return () => {};
    });
    llenarBolsa();

    const { result } = renderHook(() => useBolsa());

    expect(result.current.estado).toBe("hidratando");
    expect(result.current.reconciliado).toBeNull();
    expect(pedir).not.toHaveBeenCalled();

    hidratada.mockReturnValue(true);
    act(() => terminar());

    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("con la bolsa vacía no hace ninguna llamada", () => {
    const { result } = renderHook(() => useBolsa());

    expect(result.current.estado).toBe("listo");
    expect(result.current.reconciliado?.lineas).toEqual([]);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("pide /api/bolsa una sola vez con los productos de la bolsa y calcula los totales", async () => {
    llenarBolsa();

    const { result } = renderHook(() => useBolsa());

    expect(result.current.estado).toBe("cargando");
    await waitFor(() => expect(result.current.estado).toBe("listo"));

    expect(pedir).toHaveBeenCalledTimes(1);
    const [url, opciones] = pedir.mock.calls[0];
    expect(url).toBe(`/api/bolsa?ids=${[ID_A, ID_B].sort().join(",")}`);
    expect(opciones).toMatchObject({ cache: "no-store" });

    expect(result.current.datos).toEqual(DATOS);
    expect(result.current.reconciliado?.pedibles).toHaveLength(3);
    // 3 unidades del brillo a $7.500 + 1 brocha a $16.000.
    expect(result.current.totales?.total).toBe(38500);
  });

  it("cambiar una cantidad, quitar y deshacer no vuelven a pedir los datos", async () => {
    llenarBolsa();
    const { result } = renderHook(() => useBolsa());
    await waitFor(() => expect(result.current.estado).toBe("listo"));

    const brocha = useCarrito.getState().lineas[2];
    act(() => useCarrito.getState().establecer(ID_A, "t1", 4));
    act(() => useCarrito.getState().quitar(ID_B, null));
    act(() => useCarrito.getState().restaurar(brocha, 2));

    expect(result.current.estado).toBe("listo");
    // 5 brillos a $7.500 + la brocha = $53.500, que ya pasa los $50.000 del 5 %.
    expect(result.current.totales?.subtotalBase).toBe(53500);
    expect(result.current.totales?.total).toBe(53500 - 2675);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("si la petición falla queda en error y reintentar() vuelve a pedir", async () => {
    llenarBolsa();
    pedir.mockResolvedValueOnce(respuesta({ error: "caído" }, false));

    const { result } = renderHook(() => useBolsa());
    await waitFor(() => expect(result.current.estado).toBe("error"));
    expect(pedir).toHaveBeenCalledTimes(1);

    act(() => result.current.reintentar());

    await waitFor(() => expect(result.current.estado).toBe("listo"));
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("si la red se cae también queda en error, sin lanzar", async () => {
    llenarBolsa();
    pedir.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useBolsa());

    await waitFor(() => expect(result.current.estado).toBe("error"));
  });

  it("reintentar() con datos a la vista los refresca sin volver a «cargando»", async () => {
    llenarBolsa();
    const { result } = renderHook(() => useBolsa());
    await waitFor(() => expect(result.current.estado).toBe("listo"));

    const agotado = { ...DATOS, productos: [{ ...DATOS.productos[0], stock: 1 }, DATOS.productos[1]] };
    pedir.mockResolvedValueOnce(respuesta(agotado));
    act(() => result.current.reintentar());

    expect(result.current.estado).toBe("listo");
    await waitFor(() => expect(result.current.reconciliado?.hayCambios).toBe(true));
    expect(pedir).toHaveBeenCalledTimes(2);
  });
});
