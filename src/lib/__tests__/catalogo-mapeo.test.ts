import { describe, it, expect, vi } from "vitest";

// `server-only` revienta fuera de un Server Component; en pruebas se neutraliza.
vi.mock("server-only", () => ({}));

import { mapearProducto, type FilaProducto } from "@/lib/data/catalogo";
import type { Categoria } from "@/lib/types";

function categoria(
  id: string,
  slug: string,
  categoriaPadreId: string | null,
  etiquetaVariante: Categoria["etiquetaVariante"] = null
): Categoria {
  return { id, nombre: `Nombre ${slug}`, slug, orden: 1, categoriaPadreId, etiquetaVariante };
}

const categorias: Categoria[] = [
  categoria("d-labios", "labios", null),
  categoria("c-gloss", "lip-gloss", "d-labios"),
  categoria("c-paletas", "paletas", null, "Paleta"),
  categoria("d-bolsos", "bolsos-y-accesorios", null),
  categoria("c-espejos", "espejos", "d-bolsos"),
];

const fila: FilaProducto = {
  id: "p1",
  referencia: "REF-101",
  nombre: "Labial Rojo Pasión",
  descripcion: "Mate de larga duración",
  category_id: "c-gloss",
  imagen_principal: "https://ejemplo/labial.jpg",
  galeria: ["https://ejemplo/a.jpg"],
  stock: 12,
  activo: true,
  destacado: true,
  etiqueta_variante: null,
  num_tonos: 6,
  price_tiers: [
    { min_cantidad: 6, precio_unitario: 8000 },
    { min_cantidad: 1, precio_unitario: 10000 },
    { min_cantidad: 3, precio_unitario: 9000 },
  ],
};

describe("mapearProducto", () => {
  it("traduce la fila y ordena los escalones", () => {
    const producto = mapearProducto(fila, categorias);

    expect(producto).toMatchObject({
      id: "p1",
      referencia: "REF-101",
      categoriaId: "c-gloss",
      categoriaNombre: "Nombre lip-gloss",
      categoriaSlug: "lip-gloss",
      imagenPrincipal: "https://ejemplo/labial.jpg",
      galeria: ["https://ejemplo/a.jpg"],
      destacado: true,
    });
    expect(producto.escalones).toEqual([
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ]);
  });

  it("en la grilla cuenta las variantes con num_tonos y no las inventa", () => {
    const producto = mapearProducto(fila, categorias);

    expect(producto.numVariantes).toBe(6);
    expect(producto.variantes).toBeNull();
  });

  it("con las variantes embebidas las ordena y las cuenta de verdad", () => {
    const producto = mapearProducto(
      {
        ...fila,
        num_tonos: 9,
        product_shades: [
          { id: "v2", nombre: "Tono 2", color_hex: "#aa0000", orden: 2, agotado: true },
          { id: "v1", nombre: "Tono 1", color_hex: "#cc0000", orden: 1, agotado: false },
        ],
      },
      categorias
    );

    expect(producto.numVariantes).toBe(2);
    expect(producto.variantes).toEqual([
      { id: "v1", nombre: "Tono 1", colorHex: "#cc0000", orden: 1, agotado: false },
      { id: "v2", nombre: "Tono 2", colorHex: "#aa0000", orden: 2, agotado: true },
    ]);
  });

  it("hereda la etiqueta de la categoría cuando el producto no tiene", () => {
    const producto = mapearProducto({ ...fila, category_id: "c-paletas" }, categorias);
    expect(producto.etiquetaVariante).toBe("Paleta");
  });

  it("sin etiquetas usa el valor por defecto del departamento", () => {
    expect(mapearProducto({ ...fila, category_id: "c-espejos" }, categorias).etiquetaVariante).toBe(
      "Color"
    );
    expect(mapearProducto(fila, categorias).etiquetaVariante).toBe("Tono");
  });

  it("la etiqueta del producto manda y una desconocida se ignora", () => {
    const propia = mapearProducto(
      { ...fila, category_id: "c-paletas", etiqueta_variante: "Diseño" },
      categorias
    );
    const desconocida = mapearProducto(
      { ...fila, category_id: "c-paletas", etiqueta_variante: "Sabor" },
      categorias
    );

    expect(propia.etiquetaVariante).toBe("Diseño");
    expect(desconocida.etiquetaVariante).toBe("Paleta");
  });

  it("tolera nulos y una categoría que ya no está en la lista", () => {
    const producto = mapearProducto(
      {
        ...fila,
        descripcion: null,
        category_id: "c-oculta",
        imagen_principal: null,
        galeria: null,
        price_tiers: null,
        destacado: undefined,
        num_tonos: undefined,
      },
      categorias
    );

    expect(producto.galeria).toEqual([]);
    expect(producto.escalones).toEqual([]);
    expect(producto.categoriaNombre).toBeNull();
    expect(producto.categoriaSlug).toBeNull();
    expect(producto.destacado).toBe(false);
    expect(producto.numVariantes).toBe(0);
    expect(producto.etiquetaVariante).toBe("Tono");
  });
});
