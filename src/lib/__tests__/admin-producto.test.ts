import { describe, it, expect } from "vitest";
import { leerFormularioProducto } from "@/lib/admin/producto";

const FOTOS = "https://abc.supabase.co/storage/v1/object/public/productos/";
const ID = "0b9a7a52-3c8e-4f0e-9a51-2f3f6f3c1a10";
const CATEGORIA = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

function formulario(campos: Record<string, string | null> = {}): FormData {
  const base: Record<string, string | null> = {
    id: "",
    referencia: " gls735 ",
    nombre: "  Brillo   labial Oil Glazed ",
    descripcion: "",
    stock: "12",
    category_id: CATEGORIA,
    etiqueta_variante: "",
    etiqueta_efectiva: "Tono",
    activo: "on",
    destacado: null,
    imagen_principal: `${FOTOS}a.jpg`,
    escalones: JSON.stringify([
      { minCantidad: 1, precioUnitario: 8000 },
      { minCantidad: 3, precioUnitario: 7500 },
    ]),
    variantes: JSON.stringify([
      { id: null, nombre: "Tono 1", colorHex: "#E5308A", agotado: false },
      { id: "v2", nombre: "Tono 2", colorHex: "#c08a7a", agotado: true },
    ]),
  };
  const datos = new FormData();
  for (const [clave, valor] of Object.entries({ ...base, ...campos })) {
    if (valor !== null) datos.set(clave, valor);
  }
  return datos;
}

const opciones = { prefijoFotos: FOTOS, imagenActual: null };

describe("leerFormularioProducto", () => {
  it("limpia y tipa un formulario correcto", () => {
    expect(leerFormularioProducto(formulario(), opciones)).toEqual({
      ok: true,
      producto: {
        id: null,
        referencia: "GLS735",
        nombre: "Brillo labial Oil Glazed",
        descripcion: null,
        stock: 12,
        categoriaId: CATEGORIA,
        etiquetaVariante: null,
        activo: true,
        destacado: false,
        imagenPrincipal: `${FOTOS}a.jpg`,
        escalones: [
          { minCantidad: 1, precioUnitario: 8000 },
          { minCantidad: 3, precioUnitario: 7500 },
        ],
        variantes: [
          { id: null, nombre: "Tono 1", colorHex: "#e5308a", agotado: false },
          { id: "v2", nombre: "Tono 2", colorHex: "#c08a7a", agotado: true },
        ],
      },
    });
  });

  it("«Según la categoría» se guarda como null y una etiqueta válida se conserva", () => {
    const segun = leerFormularioProducto(formulario({ etiqueta_variante: "" }), opciones);
    const color = leerFormularioProducto(formulario({ etiqueta_variante: "Color" }), opciones);
    expect(segun.ok && segun.producto.etiquetaVariante).toBeNull();
    expect(color.ok && color.producto.etiquetaVariante).toBe("Color");
  });

  it("reúne todos los errores por campo antes de escribir nada", () => {
    const resultado = leerFormularioProducto(
      formulario({ referencia: " ", nombre: "", stock: "-1", etiqueta_variante: "Sabor" }),
      opciones
    );
    expect(resultado).toEqual({
      ok: false,
      error: "Revisa los campos marcados.",
      campos: {
        referencia: "Escribe la referencia.",
        nombre: "Escribe el nombre.",
        stock: "Escribe cuántas unidades hay: 0 o más.",
        etiqueta_variante: "Elige una de las opciones de la lista.",
      },
    });
  });

  it("exige el precio de 1 unidad y escalones sin repetir", () => {
    const sinUno = leerFormularioProducto(
      formulario({ escalones: JSON.stringify([{ minCantidad: 3, precioUnitario: 7000 }]) }),
      opciones
    );
    expect(!sinUno.ok && sinUno.campos?.escalones).toBe(
      "Falta el precio de 1 unidad: sin él no se puede vender una sola."
    );

    const repetidos = leerFormularioProducto(
      formulario({
        escalones: JSON.stringify([
          { minCantidad: 1, precioUnitario: 8000 },
          { minCantidad: 1, precioUnitario: 7000 },
        ]),
      }),
      opciones
    );
    expect(!repetidos.ok && repetidos.campos?.escalones).toBe("Hay dos precios con la misma cantidad mínima.");
  });

  it("no descarta en silencio un escalón sin precio", () => {
    const resultado = leerFormularioProducto(
      formulario({
        escalones: JSON.stringify([
          { minCantidad: 1, precioUnitario: 8000 },
          { minCantidad: 6, precioUnitario: null },
        ]),
      }),
      opciones
    );
    expect(!resultado.ok && resultado.campos?.escalones).toBe(
      "Escribe el precio desde 6 unidades o quita esa fila."
    );
  });

  it("pasa los errores de las variantes con la etiqueta del producto", () => {
    const resultado = leerFormularioProducto(
      formulario({
        etiqueta_efectiva: "Color",
        variantes: JSON.stringify([
          { id: null, nombre: "Rojo", colorHex: "#aa0000", agotado: false },
          { id: null, nombre: "rojo", colorHex: "#bb0000", agotado: false },
        ]),
      }),
      opciones
    );
    expect(!resultado.ok && resultado.campos?.variantes).toBe("Dos colores tienen el mismo nombre: «rojo». Cambia uno.");
  });

  it("rechaza datos manipulados: id, categoría o variantes con forma rara", () => {
    const malos = [
      formulario({ id: "123" }),
      formulario({ category_id: "labios" }),
      formulario({ variantes: "{no es json" }),
      formulario({ variantes: JSON.stringify([{ id: 5, nombre: "x", colorHex: "#000000", agotado: "si" }]) }),
      formulario({ escalones: JSON.stringify({ minCantidad: 1 }) }),
    ];
    for (const datos of malos) expect(leerFormularioProducto(datos, opciones).ok).toBe(false);
  });

  it("solo acepta fotos del bucket, salvo la que el producto ya tenía", () => {
    const ajena = formulario({ imagen_principal: "https://otro.com/foto.jpg" });
    expect(leerFormularioProducto(ajena, opciones)).toMatchObject({
      ok: false,
      campos: { imagen_principal: "La foto debe subirse desde este formulario." },
    });
    expect(
      leerFormularioProducto(ajena, { prefijoFotos: FOTOS, imagenActual: "https://otro.com/foto.jpg" }).ok
    ).toBe(true);

    const sinFoto = leerFormularioProducto(formulario({ imagen_principal: "" }), opciones);
    expect(sinFoto.ok && sinFoto.producto.imagenPrincipal).toBeNull();
  });

  it("acepta el id de un producto existente", () => {
    const resultado = leerFormularioProducto(formulario({ id: ID }), opciones);
    expect(resultado.ok && resultado.producto.id).toBe(ID);
  });
});
