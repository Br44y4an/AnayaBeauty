import { describe, it, expect } from "vitest";
import { cifrasDelPlan, describirCambio, idDeCategoria, planImportacion } from "@/lib/admin/importacion";
import type { FilaCSV } from "@/lib/csv";
import type { Categoria, Producto } from "@/lib/types";

const CATEGORIAS: Categoria[] = [
  { id: "c-labios", nombre: "Labios", slug: "labios", orden: 30, categoriaPadreId: null, etiquetaVariante: "Tono" },
  { id: "c-gloss", nombre: "Lip gloss", slug: "lip-gloss", orden: 1, categoriaPadreId: "c-labios", etiquetaVariante: null },
  { id: "c-brochas", nombre: "Brochas y pinceles", slug: "brochas-y-pinceles", orden: 2, categoriaPadreId: null, etiquetaVariante: null },
];

function producto(referencia: string, extra: Partial<Producto> = {}): Producto {
  return {
    id: `id-${referencia}`,
    referencia,
    nombre: `Producto ${referencia}`,
    descripcion: "Larga duración",
    categoriaId: "c-gloss",
    categoriaNombre: "Lip gloss",
    categoriaSlug: "lip-gloss",
    imagenPrincipal: null,
    galeria: [],
    stock: 12,
    activo: true,
    destacado: false,
    escalones: [
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ],
    etiquetaVariante: "Tono",
    numVariantes: 0,
    variantes: null,
    ...extra,
  };
}

function fila(referencia: string, extra: Partial<FilaCSV> = {}): FilaCSV {
  return {
    linea: 2,
    referencia,
    nombre: null,
    descripcion: null,
    categoria: null,
    stock: null,
    escalones: [],
    ...extra,
  };
}

const existentes = (...productos: Producto[]) => new Map(productos.map((p) => [p.referencia, p]));

describe("planImportacion", () => {
  it("una referencia nueva va a nuevos", () => {
    const nueva = fila("REF-9", { nombre: "Rubor durazno", escalones: [{ minCantidad: 1, precioUnitario: 12000 }] });
    const plan = planImportacion([nueva], existentes(producto("REF-1")), CATEGORIAS);
    expect(plan.nuevos).toEqual([nueva]);
    expect(plan.cambios).toEqual([]);
    expect(plan.sinCambios).toBe(0);
  });

  it("precios iguales y columnas vacías cuentan como sin cambios", () => {
    const igual = fila("REF-1", {
      escalones: [
        { minCantidad: 1, precioUnitario: 10000 },
        { minCantidad: 3, precioUnitario: 9000 },
      ],
    });
    const plan = planImportacion([igual], existentes(producto("REF-1")), CATEGORIAS);
    expect(plan.sinCambios).toBe(1);
    expect(plan.cambios).toEqual([]);
    expect(plan.nuevos).toEqual([]);
  });

  it("un stock vacío no incluye stock en los campos", () => {
    const plan = planImportacion(
      [fila("REF-1", { nombre: "Brillo labial Oil Glazed", stock: null })],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(plan.cambios).toHaveLength(1);
    expect(plan.cambios[0].campos).toEqual({ nombre: "Brillo labial Oil Glazed" });
    expect(plan.cambios[0].campos).not.toHaveProperty("stock");
  });

  it("un stock con valor distinto sí se incluye, también si es 0", () => {
    const plan = planImportacion([fila("REF-1", { stock: 0 })], existentes(producto("REF-1")), CATEGORIAS);
    expect(plan.cambios[0]).toEqual({
      referencia: "REF-1",
      id: "id-REF-1",
      campos: { stock: 0 },
      antes: { stock: 12 },
    });
  });

  it("nunca incluye activo, ni para publicar un oculto", () => {
    const oculto = producto("REF-2", { activo: false });
    const plan = planImportacion(
      [fila("REF-2", { nombre: "Otro nombre", stock: 5, descripcion: "Nueva" })],
      existentes(oculto),
      CATEGORIAS
    );
    expect(Object.keys(plan.cambios[0].campos).sort()).toEqual(["descripcion", "nombre", "stock"]);
  });

  it("solo cambia los escalones que traen un precio distinto y no borra los demás", () => {
    const plan = planImportacion(
      [fila("REF-1", { escalones: [{ minCantidad: 1, precioUnitario: 10000 }, { minCantidad: 3, precioUnitario: 9500 }] })],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(plan.cambios[0].campos).toEqual({ escalones: [{ minCantidad: 3, precioUnitario: 9500 }] });
    expect(plan.cambios[0].antes).toEqual({ escalones: [{ minCantidad: 3, precioUnitario: 9000 }] });
  });

  it("un escalón que el producto no tenía se agrega", () => {
    const sinTres = producto("REF-1", { escalones: [{ minCantidad: 1, precioUnitario: 10000 }] });
    const plan = planImportacion(
      [fila("REF-1", { escalones: [{ minCantidad: 1, precioUnitario: 10000 }, { minCantidad: 3, precioUnitario: 9000 }] })],
      existentes(sinTres),
      CATEGORIAS
    );
    expect(plan.cambios[0].campos).toEqual({ escalones: [{ minCantidad: 3, precioUnitario: 9000 }] });
    expect(plan.cambios[0].antes).toEqual({ escalones: [] });
  });

  it("una descripción vacía no borra la que había", () => {
    const plan = planImportacion([fila("REF-1", { descripcion: null })], existentes(producto("REF-1")), CATEGORIAS);
    expect(plan.sinCambios).toBe(1);
  });

  it("la categoría se busca por nombre sin importar mayúsculas ni tildes", () => {
    const plan = planImportacion(
      [fila("REF-1", { categoria: "brochas y PINCELES" })],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(plan.cambios[0].campos).toEqual({ category_id: "c-brochas" });
    expect(plan.cambios[0].antes).toEqual({ category_id: "c-gloss" });
  });

  it("una categoría que no existe deja la que tenía y avisa", () => {
    const plan = planImportacion([fila("REF-1", { linea: 4, categoria: "Perfumes" })], existentes(producto("REF-1")), CATEGORIAS);
    expect(plan.sinCambios).toBe(1);
    expect(plan.avisos).toEqual([
      "Línea 4 (REF-1): no existe la categoría «Perfumes»; se deja la que tenía.",
    ]);
  });

  it("una referencia nueva sin nombre o sin precio de 1 unidad no se crea y avisa", () => {
    const plan = planImportacion(
      [
        fila("REF-7", { linea: 2, escalones: [{ minCantidad: 1, precioUnitario: 9000 }] }),
        fila("REF-8", { linea: 3, nombre: "Pestañas" }),
      ],
      existentes(),
      CATEGORIAS
    );
    expect(plan.nuevos).toEqual([]);
    expect(plan.avisos).toEqual([
      "Línea 2 (REF-7): es nueva y le falta el nombre; no se crea.",
      "Línea 3 (REF-8): es nueva y le falta precio_1, el precio de 1 unidad; no se crea.",
    ]);
  });

  it("una referencia nueva con categoría desconocida se crea sin categoría y avisa", () => {
    const nueva = fila("REF-9", {
      linea: 5,
      nombre: "Espejo",
      categoria: "Espejitos",
      escalones: [{ minCantidad: 1, precioUnitario: 15000 }],
    });
    const plan = planImportacion([nueva], existentes(), CATEGORIAS);
    expect(plan.nuevos).toEqual([nueva]);
    expect(plan.avisos).toEqual(["Línea 5 (REF-9): no existe la categoría «Espejitos»; se crea sin categoría."]);
  });

  it("si una referencia se repite, manda la última fila y avisa", () => {
    const plan = planImportacion(
      [fila("REF-1", { linea: 2, stock: 3 }), fila("REF-1", { linea: 6, stock: 4 })],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(plan.cambios.map((c) => c.campos)).toEqual([{ stock: 4 }]);
    expect(plan.avisos).toEqual(["Línea 6 (REF-1): la referencia ya venía en la línea 2; se usa esta fila."]);
  });

  it("avisa si un precio por cantidad queda más caro que el de 1 unidad", () => {
    const plan = planImportacion(
      [fila("REF-1", { linea: 3, escalones: [{ minCantidad: 3, precioUnitario: 11000 }] })],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(plan.cambios).toHaveLength(1);
    expect(plan.avisos).toEqual([
      "Línea 3 (REF-1): el precio desde 3 unidades ($11.000) queda más caro que el de 1 ($10.000).",
    ]);
  });

  it("no importa filas con textos más largos de lo que acepta el formulario", () => {
    const plan = planImportacion(
      [
        fila("R".repeat(41), { linea: 2, nombre: "Labial", escalones: [{ minCantidad: 1, precioUnitario: 9000 }] }),
        fila("REF-1", { linea: 3, nombre: "x".repeat(121) }),
        fila("REF-2", { linea: 4, descripcion: "x".repeat(1001) }),
      ],
      existentes(producto("REF-1"), producto("REF-2")),
      CATEGORIAS
    );
    expect(plan.nuevos).toEqual([]);
    expect(plan.cambios).toEqual([]);
    expect(plan.avisos).toEqual([
      `Línea 2 (${"R".repeat(41)}): la referencia pasa de 40 caracteres; no se importa.`,
      "Línea 3 (REF-1): el nombre pasa de 120 caracteres; no se importa.",
      "Línea 4 (REF-2): la descripción pasa de 1.000 caracteres; no se importa.",
    ]);
  });

  it("funciona sin lista de categorías: avisa y no toca la categoría", () => {
    const plan = planImportacion([fila("REF-1", { categoria: "Lip gloss" })], existentes(producto("REF-1")));
    expect(plan.sinCambios).toBe(1);
    expect(plan.avisos).toHaveLength(1);
  });
});

describe("idDeCategoria", () => {
  it("encuentra por nombre o por slug y devuelve null si no existe", () => {
    expect(idDeCategoria("LIP GLOSS", CATEGORIAS)).toBe("c-gloss");
    expect(idDeCategoria("lip-gloss", CATEGORIAS)).toBe("c-gloss");
    expect(idDeCategoria("Perfumes", CATEGORIAS)).toBeNull();
    expect(idDeCategoria("  ", CATEGORIAS)).toBeNull();
  });
});

describe("describirCambio", () => {
  it("dice cada cambio con el valor de antes y el de después", () => {
    const plan = planImportacion(
      [
        fila("REF-1", {
          nombre: "Brillo labial",
          categoria: "Brochas y pinceles",
          stock: 0,
          escalones: [
            { minCantidad: 3, precioUnitario: 9500 },
            { minCantidad: 12, precioUnitario: 7000 },
          ],
        }),
      ],
      existentes(producto("REF-1")),
      CATEGORIAS
    );
    expect(describirCambio(plan.cambios[0], CATEGORIAS)).toEqual([
      "Nombre: «Producto REF-1» → «Brillo labial»",
      "Categoría: Lip gloss → Brochas y pinceles",
      "Stock: 12 → 0",
      "Precio desde 3: $9.000 → $9.500",
      "Precio desde 12: nuevo, $7.000",
    ]);
  });

  it("nombra el precio de 1 unidad, la descripción y la falta de categoría", () => {
    const sinCategoria = producto("REF-2", { categoriaId: null, descripcion: null });
    const plan = planImportacion(
      [
        fila("REF-2", {
          descripcion: "Acabado satinado de larga duración, ideal para el día a día y para eventos largos",
          categoria: "Labios",
          escalones: [{ minCantidad: 1, precioUnitario: 11000 }],
        }),
      ],
      existentes(sinCategoria),
      CATEGORIAS
    );
    expect(describirCambio(plan.cambios[0], CATEGORIAS)).toEqual([
      "Descripción: «Acabado satinado de larga duración, ideal para el día a día…»",
      "Categoría: Sin categoría → Labios",
      "Precio de 1 unidad: $10.000 → $11.000",
    ]);
  });
});

describe("cifrasDelPlan", () => {
  it("cuenta lo que conviene revisar antes de confirmar", () => {
    const plan = planImportacion(
      [
        fila("REF-1", { linea: 2, stock: 0 }),
        fila("REF-2", { linea: 3, escalones: [{ minCantidad: 1, precioUnitario: 9000 }] }),
        fila("REF-3", { linea: 4, stock: 0, escalones: [{ minCantidad: 6, precioUnitario: 7000 }] }),
        fila("REF-4", { linea: 5, stock: 12 }),
      ],
      existentes(producto("REF-1"), producto("REF-2"), producto("REF-3", { stock: 4 }), producto("REF-4")),
      CATEGORIAS
    );
    expect(cifrasDelPlan(plan)).toEqual({ cambianPrecio: 2, quedanSinStock: 2 });
  });
});
