// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import type { SugerenciaProducto } from "@/lib/types";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/lib/busqueda-rapida", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/busqueda-rapida")>();
  return { ...real, cerrarBusqueda: vi.fn(real.cerrarBusqueda) };
});

import { abrirBusqueda, cerrarBusqueda } from "@/lib/busqueda-rapida";
import { BusquedaRapida } from "@/components/catalogo/BusquedaRapida";
import { CampoBusqueda } from "@/components/catalogo/CampoBusqueda";

const sugerencia = (referencia: string, nombre: string, precioBase: number): SugerenciaProducto => ({
  referencia,
  nombre,
  imagenPrincipal: null,
  precioBase,
  numVariantes: 6,
  etiquetaVariante: "Tono",
});

const DOS = {
  total: 2,
  productos: [sugerencia("USK-621", "Lip gloss gummy", 8000), sugerencia("USK-208", "Iluminador corporal", 17000)],
};

function responder(cuerpo: unknown) {
  const fetchFalso = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => cuerpo,
  }));
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function montar() {
  render(
    <BusquedaRapida whatsapp="573001112233" departamentos={[{ nombre: "Labios", slug: "labios" }]} />
  );
  act(() => abrirBusqueda());
  return screen.getByRole("searchbox", { name: "Buscar" });
}

async function escribir(campo: HTMLElement, texto: string) {
  fireEvent.change(campo, { target: { value: texto } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

describe("BusquedaRapida", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "");
    // Como el navegador: «Atrás» dispara popstate.
    vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    act(() => cerrarBusqueda());
    vi.mocked(cerrarBusqueda).mockClear();
    push.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("escribir «usk» muestra las sugerencias después del debounce, con enlace a la ficha", async () => {
    const fetchFalso = responder(DOS);
    const campo = montar();

    fireEvent.change(campo, { target: { value: "usk" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(fetchFalso).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/buscar?q=usk");

    const enlaces = within(screen.getByRole("list", { name: "Sugerencias" })).getAllByRole("link");
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]).toHaveAttribute("href", "/producto/USK-621");
    expect(enlaces[0]).toHaveTextContent("Lip gloss gummy");
    expect(enlaces[0]).toHaveTextContent("Ref. USK-621");
    expect(enlaces[0]).toHaveTextContent("$8.000");
    expect(enlaces[1]).toHaveAttribute("href", "/producto/USK-208");
  });

  it("«Ver los 2 resultados» lleva al catálogo filtrado y cierra la búsqueda", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk");

    const verTodos = screen.getByRole("link", { name: "Ver los 2 resultados" });
    expect(verTodos).toHaveAttribute("href", "/?q=usk");

    fireEvent.click(verTodos);

    expect(cerrarBusqueda).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/?q=usk", { scroll: true });
  });

  it("tocar una sugerencia cierra la búsqueda y abre la ficha sin mover la página de fondo", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk");

    fireEvent.click(screen.getByRole("link", { name: /Lip gloss gummy/ }));

    expect(cerrarBusqueda).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/producto/USK-621", { scroll: false });
  });

  it("dos toques seguidos en una sugerencia hacen un solo «Atrás» y una sola navegación", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk");
    // Como en el navegador: el popstate de history.back() llega después, no en el mismo toque.
    const atras = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.setTimeout(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })), 30);
    });

    const enlace = screen.getByRole("link", { name: /Lip gloss gummy/ });
    fireEvent.click(enlace);
    fireEvent.click(screen.getByRole("link", { name: /Iluminador corporal/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });

    expect(atras).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/producto/USK-621", { scroll: false });
  });

  it("un toque durante la salida no deja una navegación pendiente para el siguiente cierre", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk");

    fireEvent.click(screen.getByRole("link", { name: /Lip gloss gummy/ }));
    // La hoja sigue pintada unos ms mientras sale: un segundo toque ahí no cuenta.
    fireEvent.click(screen.getByRole("link", { name: /Iluminador corporal/ }));
    expect(push).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    act(() => abrirBusqueda());
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Buscar" }), { key: "Escape" });

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("Enter con «usk621» abre el producto cuya referencia compacta coincide", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk621");

    fireEvent.submit(screen.getByRole("search"));
    await act(async () => {});

    expect(push).toHaveBeenCalledWith("/producto/USK-621", { scroll: false });
    expect(cerrarBusqueda).toHaveBeenCalledTimes(1);
  });

  it("Enter antes del debounce busca en el momento; sin coincidencia exacta va al catálogo", async () => {
    const fetchFalso = responder(DOS);
    const campo = montar();

    fireEvent.change(campo, { target: { value: "gloss" } });
    fireEvent.submit(screen.getByRole("search"));
    await act(async () => {});

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/?q=gloss", { scroll: true });
  });

  it("Escape llama cerrarBusqueda y no navega", () => {
    const campo = montar();

    fireEvent.keyDown(campo, { key: "Escape" });

    expect(cerrarBusqueda).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("sin resultados lo dice y ofrece WhatsApp con lo que buscó", async () => {
    responder({ total: 0, productos: [] });
    const campo = montar();
    await escribir(campo, "xyz");

    expect(screen.getByText("No encontramos “xyz”")).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    const href = whatsapp.getAttribute("href") ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/573001112233\?text=/);
    expect(decodeURIComponent(href)).toContain("xyz");
  });

  it("con menos de 2 letras no busca y ofrece los departamentos", async () => {
    const fetchFalso = responder(DOS);
    const campo = montar();

    expect(screen.getByRole("link", { name: "Labios" })).toHaveAttribute("href", "/?categoria=labios");
    expect(screen.getByText(/por la referencia que viste en el live/)).toBeInTheDocument();

    await escribir(campo, "u");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("codifica las referencias con barra o porcentaje", async () => {
    responder({ total: 2, productos: [sugerencia("AC80/150", "Acrílico", 9000), sugerencia("100%", "Set", 5000)] });
    const campo = montar();
    await escribir(campo, "ac80");

    expect(screen.getByRole("link", { name: /Acrílico/ })).toHaveAttribute("href", "/producto/AC80%2F150");
    expect(screen.getByRole("link", { name: /Set/ })).toHaveAttribute("href", "/producto/100%25");
  });

  it("«Borrar» vacía el campo, le devuelve el foco y es un objetivo de 44 px", async () => {
    responder(DOS);
    const campo = montar();
    await escribir(campo, "usk");

    const borrar = screen.getByRole("button", { name: "Borrar" });
    // jsdom no mide: la altura mínima se comprueba por la clase (min-h-11 = 44 px).
    expect(borrar).toHaveClass("min-h-11");

    fireEvent.click(borrar);

    expect(campo).toHaveValue("");
    expect(document.activeElement).toBe(campo);
    expect(screen.queryByRole("button", { name: "Borrar" })).not.toBeInTheDocument();
  });

  it("si la búsqueda falla deja volver a intentar", async () => {
    const fetchFalso = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchFalso);
    const campo = montar();
    await escribir(campo, "usk");

    expect(screen.getByText("No pudimos buscar en este momento.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
    await act(async () => {});

    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("CampoBusqueda abre la búsqueda con el campo enfocado", () => {
    render(
      <>
        <CampoBusqueda />
        <BusquedaRapida whatsapp="573001112233" departamentos={[]} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Busca por nombre o referencia" }));

    expect(screen.getByRole("dialog", { name: "Buscar productos" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Buscar" }));
  });

  it("CampoBusqueda con texto abre la búsqueda con ese texto y lo busca", async () => {
    const fetchFalso = responder(DOS);
    render(
      <>
        <CampoBusqueda texto="usk" />
        <BusquedaRapida whatsapp="573001112233" departamentos={[]} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /usk/ }));
    await act(async () => {});

    expect(screen.getByRole("searchbox", { name: "Buscar" })).toHaveValue("usk");
    expect(fetchFalso).toHaveBeenCalledWith("/api/buscar?q=usk", expect.anything());
  });
});
