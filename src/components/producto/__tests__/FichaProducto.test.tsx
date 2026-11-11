import { describe, it, expect, vi, beforeEach } from "vitest";
import { descripcionUtil, metadataDeProducto } from "@/components/producto/FichaProducto";
import type { Producto } from "@/lib/types";

const datos = vi.hoisted(() => ({ obtenerProductoPorReferencia: vi.fn() }));

vi.mock("@/lib/data/catalogo", () => ({
  obtenerProductoPorReferencia: datos.obtenerProductoPorReferencia,
  obtenerRelacionados: vi.fn(),
}));
vi.mock("@/lib/data/configuracion", () => ({ obtenerConfiguracionPublica: vi.fn() }));

const acrilico: Producto = {
  id: "p1",
  referencia: "AC80/150",
  nombre: "Acrílico 80 × 150",
  descripcion: null,
  categoriaId: null,
  categoriaNombre: null,
  categoriaSlug: null,
  imagenPrincipal: "https://ejemplo.test/ac.jpeg",
  galeria: [],
  stock: 10,
  activo: true,
  destacado: false,
  escalones: [
    { minCantidad: 1, precioUnitario: 8000 },
    { minCantidad: 3, precioUnitario: 7500 },
  ],
  etiquetaVariante: "Color",
  numVariantes: 0,
  variantes: [],
};

beforeEach(() => datos.obtenerProductoPorReferencia.mockReset());

describe("descripcionUtil", () => {
  it("omite la que solo repite el nombre, con o sin cuántos tonos hay", () => {
    expect(descripcionUtil({ nombre: "Brillo rolón.", descripcion: "Brillo rolón. 6 tonos" })).toBeNull();
    expect(descripcionUtil({ nombre: "Corrector líquido", descripcion: "Corrector liquido" })).toBeNull();
    expect(descripcionUtil({ nombre: "Lip gloss", descripcion: "   " })).toBeNull();
  });

  it("conserva la que agrega algo, tal como la escribió la dueña", () => {
    const descripcion = "Brillo labial Oil Glazed Shine. 6 Tonos, aplicador grueso";
    expect(descripcionUtil({ nombre: "Brillo labial Oil Glazed Shine", descripcion })).toBe(descripcion);
    expect(descripcionUtil({ nombre: "Agua micelar", descripcion: "Agua micelar bifasica 150ml" })).toBe(
      "Agua micelar bifasica 150ml"
    );
  });
});

describe("metadataDeProducto", () => {
  it("decodifica la referencia una sola vez y describe el producto con su precio", async () => {
    datos.obtenerProductoPorReferencia.mockResolvedValue(acrilico);

    const metadata = await metadataDeProducto("AC80%2F150");

    expect(datos.obtenerProductoPorReferencia).toHaveBeenCalledWith("AC80/150");
    expect(metadata.title).toBe("Acrílico 80 × 150");
    expect(metadata.description).toBe(
      "Acrílico 80 × 150. $8.000 c/u; 3 o más: $7.500 c/u. Ref. AC80/150. Pídelo en el catálogo de Anaya Beauty."
    );
  });

  it("con un «%» suelto no consulta nada y no falla", async () => {
    const metadata = await metadataDeProducto("100%");

    expect(datos.obtenerProductoPorReferencia).not.toHaveBeenCalled();
    expect(metadata.title).toBe("Producto no disponible");
  });
});
