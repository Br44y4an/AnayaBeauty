// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListaProductos } from "@/components/catalogo/ListaProductos";
import type { PaginaProductos, Producto } from "@/lib/types";

function producto(n: number): Producto {
  return {
    id: `p${n}`,
    referencia: `REF-${n}`,
    nombre: `Producto ${n}`,
    descripcion: null,
    categoriaId: "c1",
    categoriaNombre: "Labios",
    categoriaSlug: "labios",
    imagenPrincipal: null,
    galeria: [],
    stock: 50,
    activo: true,
    destacado: false,
    escalones: [{ minCantidad: 1, precioUnitario: 8000 }],
    etiquetaVariante: "Tono",
    numVariantes: 2,
    variantes: null,
  };
}

const TODOS = Array.from({ length: 30 }, (_, i) => producto(i + 1));
const FILTROS = { categoria: "labios", q: null, orden: "precio-asc" } as const;

function respuesta(datos: PaginaProductos, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => datos };
}

function montar() {
  return render(<ListaProductos inicial={TODOS.slice(0, 24)} total={30} pagina={1} filtros={FILTROS} />);
}

describe("ListaProductos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("«Ver más productos» pide la página 2, agrega los 6 que faltan y actualiza la URL", async () => {
    const pedir = vi.fn().mockResolvedValue(
      respuesta({ productos: TODOS.slice(24), total: 30, pagina: 2, porPagina: 24 })
    );
    vi.stubGlobal("fetch", pedir);
    const reemplazar = vi.spyOn(window.history, "replaceState");
    montar();
    expect(screen.getByText("Viendo 24 de 30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver más productos" }));

    expect(await screen.findByText("Viendo 30 de 30")).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledWith("/api/catalogo?categoria=labios&orden=precio-asc&pagina=2");
    expect(screen.getAllByRole("article")).toHaveLength(30);
    expect(screen.queryByRole("button", { name: "Ver más productos" })).not.toBeInTheDocument();
    expect(reemplazar).toHaveBeenCalledWith(null, "", expect.stringContaining("pagina=2"));
  });

  it("un fallo de red muestra «No se pudo cargar.» y «Volver a intentar» pide otra vez", async () => {
    const pedir = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(respuesta({ productos: TODOS.slice(24), total: 30, pagina: 2, porPagina: 24 }));
    vi.stubGlobal("fetch", pedir);
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Ver más productos" }));
    expect(await screen.findByText("No se pudo cargar.")).toBeInTheDocument();
    expect(screen.getByText("Viendo 24 de 30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));

    expect(await screen.findByText("Viendo 30 de 30")).toBeInTheDocument();
    expect(screen.queryByText("No se pudo cargar.")).not.toBeInTheDocument();
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("una respuesta de error del servidor también se puede reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuesta({ productos: [], total: 0, pagina: 2, porPagina: 24 }, false))
    );
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Ver más productos" }));

    expect(await screen.findByRole("button", { name: "Volver a intentar" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(24);
  });

  it("no repite un producto que ya está en la lista", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuesta({ productos: TODOS.slice(23), total: 30, pagina: 2, porPagina: 24 })
      )
    );
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Ver más productos" }));

    expect(await screen.findByText("Viendo 30 de 30")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(30);
  });

  it("en la última página que se puede pedir no ofrece más y orienta a filtrar", () => {
    const muchos = Array.from({ length: 240 }, (_, i) => producto(i + 1));
    render(<ListaProductos inicial={muchos} total={372} pagina={10} filtros={FILTROS} />);

    expect(screen.getByText("Viendo 240 de 372")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más productos" })).not.toBeInTheDocument();
    expect(screen.getByText(/elige una categoría o busca/i)).toBeInTheDocument();
  });
});
