// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

type Cambio = { eventType: string; new: Record<string, unknown> };

const prueba = vi.hoisted(() => ({
  ruta: "/admin",
  refresh: vi.fn(),
  cuenta: 0,
  alCambiar: null as ((c: Cambio) => void) | null,
  alEstado: null as ((estado: string) => void) | null,
  removeChannel: vi.fn(),
  topicos: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: prueba.refresh }),
  usePathname: () => prueba.ruta,
}));

vi.mock("@/lib/supabase/client", () => ({
  crearClienteNavegador: () => {
    const canal = {
      on: (_tipo: string, _filtro: unknown, cb: (c: Cambio) => void) => {
        prueba.alCambiar = cb;
        return canal;
      },
      subscribe: (cb: (estado: string) => void) => {
        prueba.alEstado = cb;
        return canal;
      },
    };
    const consulta = {
      select: () => consulta,
      eq: () => Promise.resolve({ count: prueba.cuenta, error: null }),
    };
    return {
      channel: (topico: string) => {
        prueba.topicos.push(topico);
        return canal;
      },
      removeChannel: prueba.removeChannel,
      from: () => consulta,
    };
  },
}));

import { IndicadorEnVivo, PedidosEnVivo, useEnVivo } from "../PedidosEnVivo";

function Cuenta() {
  return <p data-testid="cuenta">{useEnVivo().nuevos}</p>;
}

function pintar(nuevos = 2) {
  return render(
    <PedidosEnVivo abiertoDesde={1000} nuevos={nuevos}>
      <IndicadorEnVivo />
      <Cuenta />
    </PedidosEnVivo>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  prueba.ruta = "/admin";
  prueba.refresh.mockReset();
  prueba.removeChannel.mockReset();
  prueba.cuenta = 0;
  prueba.topicos = [];
});

afterEach(() => vi.useRealTimers());

describe("PedidosEnVivo", () => {
  it("dice «Conectando», «En vivo» y «Reconectando» según la suscripción", () => {
    pintar();
    expect(screen.getByText("Conectando…")).toBeInTheDocument();

    act(() => prueba.alEstado!("SUBSCRIBED"));
    expect(screen.getByText("En vivo")).toBeInTheDocument();

    act(() => prueba.alEstado!("CHANNEL_ERROR"));
    expect(screen.getByText("Reconectando…")).toBeInTheDocument();
  });

  it("en Pedidos, un cambio refresca la lista una sola vez aunque lleguen varios eventos", async () => {
    pintar();
    prueba.cuenta = 3;

    act(() => {
      prueba.alCambiar!({ eventType: "INSERT", new: { numero_pedido: "AB-0100" } });
      prueba.alCambiar!({ eventType: "UPDATE", new: { numero_pedido: "AB-0100" } });
    });
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(prueba.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cuenta")).toHaveTextContent("3");
    expect(screen.getByRole("status")).toHaveTextContent("Llegó el pedido AB-0100.");
  });

  it("en otra sección solo actualiza el contador: no refresca la página abierta", async () => {
    prueba.ruta = "/admin/productos/123";
    pintar();
    prueba.cuenta = 5;

    act(() => prueba.alCambiar!({ eventType: "INSERT", new: { numero_pedido: "AB-0101" } }));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(prueba.refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("cuenta")).toHaveTextContent("5");
  });

  it("al reconectar y al volver a la pestaña vuelve a pedir la lista", async () => {
    pintar();
    act(() => prueba.alEstado!("SUBSCRIBED"));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(prueba.refresh).not.toHaveBeenCalled();

    act(() => prueba.alEstado!("TIMED_OUT"));
    act(() => prueba.alEstado!("SUBSCRIBED"));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(prueba.refresh).toHaveBeenCalledTimes(1);

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(prueba.refresh).toHaveBeenCalledTimes(2);
  });

  it("al desmontar suelta el canal y cada montaje usa un canal propio", () => {
    const { unmount } = pintar();
    unmount();
    expect(prueba.removeChannel).toHaveBeenCalledTimes(1);

    pintar();
    expect(new Set(prueba.topicos).size).toBe(2);
  });

  it("la cuenta del servidor manda cuando el layout se vuelve a pintar", () => {
    const { rerender } = pintar(2);
    rerender(
      <PedidosEnVivo abiertoDesde={1000} nuevos={7}>
        <Cuenta />
      </PedidosEnVivo>
    );
    expect(screen.getByTestId("cuenta")).toHaveTextContent("7");
  });
});
