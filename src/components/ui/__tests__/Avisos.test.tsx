// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Avisos } from "@/components/ui/Avisos";
import { avisoActual, cerrarAviso, mostrarAviso } from "@/lib/avisos";

describe("Avisos", () => {
  afterEach(() => act(() => cerrarAviso()));

  it("sin aviso deja la región viva vacía", () => {
    render(<Avisos />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("muestra título y detalle en la región viva y «Ver bolsa» como enlace a /carrito", () => {
    render(<Avisos />);

    act(() =>
      mostrarAviso({
        titulo: "Agregado a tu bolsa",
        detalle: "3 × Brillo labial Oil Glazed",
        accion: { etiqueta: "Ver bolsa", href: "/carrito" },
      })
    );

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Agregado a tu bolsa");
    expect(region).toHaveTextContent("3 × Brillo labial Oil Glazed");

    const enlace = screen.getByRole("link", { name: "Ver bolsa" });
    expect(enlace).toHaveAttribute("href", "/carrito");
    expect(enlace.querySelector("button")).toBeNull();
  });

  it("tocar «Ver bolsa» cierra el aviso", () => {
    render(<Avisos />);
    act(() =>
      mostrarAviso({ titulo: "Agregado a tu bolsa", accion: { etiqueta: "Ver bolsa", href: "/carrito" } })
    );

    fireEvent.click(screen.getByRole("link", { name: "Ver bolsa" }));

    expect(avisoActual()).toBeNull();
  });

  it("una acción con alHacer la ejecuta una vez y cierra el aviso", () => {
    const deshacer = vi.fn();
    render(<Avisos />);
    act(() =>
      mostrarAviso({ titulo: "Quitaste Tono 3", accion: { etiqueta: "Deshacer", alHacer: deshacer } })
    );

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(deshacer).toHaveBeenCalledTimes(1);
    expect(avisoActual()).toBeNull();
    expect(screen.queryByText("Quitaste Tono 3")).not.toBeInTheDocument();
  });

  it("un aviso nuevo reemplaza al anterior en pantalla", () => {
    render(<Avisos />);
    act(() => mostrarAviso({ titulo: "Agregado a tu bolsa" }));
    act(() => mostrarAviso({ titulo: "Copiado" }));

    expect(screen.queryByText("Agregado a tu bolsa")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copiado");
  });

  describe("pausa mientras lo usan", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("con foco y puntero encima, salir con el puntero no lo reanuda; quitar el foco sí", () => {
      render(<Avisos />);
      act(() =>
        mostrarAviso({ titulo: "Quitaste Tono 3", accion: { etiqueta: "Deshacer", alHacer: () => {} } })
      );
      const tarjeta = screen.getByRole("status").firstElementChild!;
      const deshacer = screen.getByRole("button", { name: "Deshacer" });

      act(() => deshacer.focus());
      fireEvent.pointerEnter(tarjeta);
      fireEvent.pointerLeave(tarjeta);
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("status")).toHaveTextContent("Quitaste Tono 3");

      act(() => deshacer.blur());
      act(() => vi.advanceTimersByTime(4999));
      expect(avisoActual()).not.toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(avisoActual()).toBeNull();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  describe("--alto-pie-fijo", () => {
    const pies: HTMLElement[] = [];
    const variable = () => document.documentElement.style.getPropertyValue("--alto-pie-fijo");

    // jsdom no calcula cajas: el alto se simula en getBoundingClientRect.
    function agregarPie(alto: number, posicion = "fixed") {
      const pie = document.createElement("div");
      pie.setAttribute("data-pie-fijo", "");
      pie.style.position = posicion;
      pie.getBoundingClientRect = () => ({ height: alto }) as DOMRect;
      document.body.append(pie);
      pies.push(pie);
      return pie;
    }

    afterEach(() => {
      pies.splice(0).forEach((pie) => pie.remove());
      vi.unstubAllGlobals();
    });

    it("con un pie fijo de 96 px la fija en 96px y al quitarlo vuelve al valor por defecto", async () => {
      render(<Avisos />);

      const pie = agregarPie(96);
      await waitFor(() => expect(variable()).toBe("96px"));

      pie.remove();
      await waitFor(() => expect(variable()).toBe(""));
    });

    it("mide el pie que ya estaba antes de montarse", () => {
      agregarPie(80, "sticky");
      render(<Avisos />);
      expect(variable()).toBe("80px");
    });

    it("toma el más alto y sigue sus cambios de tamaño", () => {
      let alAjustar: () => void = () => {};
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            alAjustar = callback;
          }
          observe() {}
          disconnect() {}
        }
      );
      agregarPie(64);
      const alto = agregarPie(96);
      render(<Avisos />);
      expect(variable()).toBe("96px");

      alto.getBoundingClientRect = () => ({ height: 120 }) as DOMRect;
      act(() => alAjustar());
      expect(variable()).toBe("120px");
    });

    it("un pie que no está fijo (la barra de la bolsa en escritorio) no lo sube", () => {
      agregarPie(96, "static");
      render(<Avisos />);
      expect(variable()).toBe("0px");
    });

    it("deja de contar el pie que pierde la marca (el modal al cerrarse) y limpia al desmontarse", async () => {
      const pie = agregarPie(96);
      const { unmount } = render(<Avisos />);
      expect(variable()).toBe("96px");

      pie.removeAttribute("data-pie-fijo");
      await waitFor(() => expect(variable()).toBe(""));

      pie.setAttribute("data-pie-fijo", "");
      await waitFor(() => expect(variable()).toBe("96px"));
      unmount();
      expect(variable()).toBe("");
    });
  });
});
