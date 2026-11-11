import { describe, it, expect } from "vitest";
import {
  contarPorFiltro,
  estadoLista,
  filtrarProductosAdmin,
  filtroDeParametro,
  urlEditarProducto,
  urlListaProductos,
} from "@/lib/admin/filtros";
import type { Categoria, Producto } from "@/lib/types";

function producto(id: string, extra: Partial<Producto> = {}): Producto {
  return {
    id,
    referencia: id.toUpperCase(),
    nombre: `Producto ${id}`,
    descripcion: null,
    categoriaId: "c-gloss",
    categoriaNombre: "Lip gloss",
    categoriaSlug: "lip-gloss",
    imagenPrincipal: "https://x.supabase.co/storage/v1/object/public/productos/a.jpg",
    galeria: [],
    stock: 10,
    activo: true,
    destacado: false,
    escalones: [{ minCantidad: 1, precioUnitario: 8000 }],
    etiquetaVariante: "Tono",
    numVariantes: 0,
    variantes: null,
    ...extra,
  };
}

const PRODUCTOS = [
  producto("activo"),
  producto("oculto", { activo: false }),
  producto("agotado", { stock: 0 }),
  producto("oculto-agotado", { activo: false, stock: 0 }),
  producto("sin-foto", { imagenPrincipal: null }),
  producto("foto-vacia", { imagenPrincipal: "" }),
  producto("destacado", { destacado: true }),
  producto("brocha", { categoriaId: "c-brochas" }),
  producto("sin-categoria", { categoriaId: null }),
];

const ids = (lista: Producto[]) => lista.map((p) => p.id);

describe("filtrarProductosAdmin", () => {
  it("todos devuelve la lista completa en el mismo orden", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "todos"))).toEqual(ids(PRODUCTOS));
  });

  it("activos y ocultos se reparten la lista", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "activos"))).not.toContain("oculto");
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "ocultos"))).toEqual(["oculto", "oculto-agotado"]);
  });

  it("agotados son los visibles sin stock", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "agotados"))).toEqual(["agotado"]);
  });

  it("sin foto incluye la imagen vacía", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "sin-foto"))).toEqual(["sin-foto", "foto-vacia"]);
  });

  it("destacados", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "destacados"))).toEqual(["destacado"]);
  });

  it("por categoría, combinable con el filtro", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "todos", "c-brochas"))).toEqual(["brocha"]);
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "ocultos", "c-gloss"))).toEqual(["oculto", "oculto-agotado"]);
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "destacados", "c-brochas"))).toEqual([]);
  });

  it("sin categoría elegida (null o vacío) no filtra", () => {
    expect(filtrarProductosAdmin(PRODUCTOS, "todos", null)).toHaveLength(PRODUCTOS.length);
    expect(filtrarProductosAdmin(PRODUCTOS, "todos", "")).toHaveLength(PRODUCTOS.length);
  });

  it("«sin-categoria» muestra los productos que no tienen", () => {
    expect(ids(filtrarProductosAdmin(PRODUCTOS, "todos", "sin-categoria"))).toEqual(["sin-categoria"]);
  });

  it("un departamento incluye a sus hijas si se pasan las categorías", () => {
    const categorias: Categoria[] = [
      { id: "c-labios", nombre: "Labios", slug: "labios", orden: 1, categoriaPadreId: null, etiquetaVariante: null },
      { id: "c-gloss", nombre: "Lip gloss", slug: "lip-gloss", orden: 1, categoriaPadreId: "c-labios", etiquetaVariante: null },
      { id: "c-brochas", nombre: "Brochas", slug: "brochas", orden: 2, categoriaPadreId: null, etiquetaVariante: null },
    ];
    const enLabios = filtrarProductosAdmin(PRODUCTOS, "activos", "c-labios", categorias);
    expect(ids(enLabios)).toEqual(["activo", "agotado", "sin-foto", "foto-vacia", "destacado"]);
    expect(filtrarProductosAdmin(PRODUCTOS, "todos", "c-labios")).toEqual([]);
  });
});

describe("contarPorFiltro", () => {
  it("cuenta cada filtro dentro de la categoría elegida", () => {
    expect(contarPorFiltro(PRODUCTOS)).toEqual({
      todos: 9,
      activos: 7,
      ocultos: 2,
      agotados: 1,
      "sin-foto": 2,
      destacados: 1,
    });
    expect(contarPorFiltro(PRODUCTOS, "c-brochas").todos).toBe(1);
  });
});

describe("estado de la lista en la URL", () => {
  it("lee los parámetros con valores seguros", () => {
    expect(estadoLista({ q: "  gloss ", filtro: "ocultos", categoria: "c-1", pagina: "3" })).toEqual({
      q: "gloss",
      filtro: "ocultos",
      categoria: "c-1",
      pagina: 3,
    });
    expect(estadoLista({ filtro: ["agotados", "x"], pagina: "-2" })).toEqual({
      q: "",
      filtro: "agotados",
      categoria: "",
      pagina: 1,
    });
  });

  it("volver a la lista conserva la búsqueda, el filtro, la categoría y la página", () => {
    const estado = estadoLista({ q: "brillo labial", filtro: "agotados", categoria: "c-1", pagina: "2" });
    expect(urlListaProductos(estado)).toBe("/admin/productos?q=brillo+labial&filtro=agotados&categoria=c-1&pagina=2");
    expect(urlEditarProducto("p-1", estado)).toBe(
      "/admin/productos/p-1?q=brillo+labial&filtro=agotados&categoria=c-1&pagina=2"
    );
  });

  it("agrega el aviso sin perder lo demás y omite los valores por defecto", () => {
    const estado = estadoLista({ q: "AC80/150 100%" });
    expect(urlListaProductos(estado, { guardado: "p-1" })).toBe("/admin/productos?q=AC80%2F150+100%25&guardado=p-1");
    expect(urlListaProductos(estadoLista({}))).toBe("/admin/productos");
  });
});

describe("filtroDeParametro", () => {
  it("acepta los filtros conocidos y cae a todos con cualquier otro valor", () => {
    expect(filtroDeParametro("ocultos")).toBe("ocultos");
    expect(filtroDeParametro("sin-foto")).toBe("sin-foto");
    expect(filtroDeParametro("borrar")).toBe("todos");
    expect(filtroDeParametro(undefined)).toBe("todos");
  });
});
