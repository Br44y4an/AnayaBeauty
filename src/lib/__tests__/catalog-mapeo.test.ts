import { describe, it, expect } from "vitest";
import { mapearProducto } from "@/lib/data/catalog";

describe("mapearProducto", () => {
  it("traduce snake_case a camelCase y ordena los escalones", () => {
    const fila = {
      id: "p1",
      referencia: "REF-101",
      nombre: "Labial Rojo Pasión",
      descripcion: "Mate de larga duración",
      category_id: "c1",
      categories: { nombre: "Labiales" },
      imagen_principal: "https://ejemplo/labial.jpg",
      galeria: ["https://ejemplo/a.jpg"],
      stock: 12,
      activo: true,
      price_tiers: [
        { min_cantidad: 6, precio_unitario: 8000 },
        { min_cantidad: 1, precio_unitario: 10000 },
        { min_cantidad: 3, precio_unitario: 9000 },
      ],
    };

    const producto = mapearProducto(fila);

    expect(producto.referencia).toBe("REF-101");
    expect(producto.categoriaId).toBe("c1");
    expect(producto.categoriaNombre).toBe("Labiales");
    expect(producto.imagenPrincipal).toBe("https://ejemplo/labial.jpg");
    expect(producto.escalones).toEqual([
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ]);
  });

  it("tolera campos nulos sin romperse", () => {
    const producto = mapearProducto({
      id: "p2",
      referencia: "REF-999",
      nombre: "Sin datos",
      descripcion: null,
      category_id: null,
      categories: null,
      imagen_principal: null,
      galeria: null,
      stock: 0,
      activo: true,
      price_tiers: null,
    });

    expect(producto.galeria).toEqual([]);
    expect(producto.escalones).toEqual([]);
    expect(producto.categoriaNombre).toBeNull();
  });
});
