import { describe, it, expect } from "vitest";
import {
  reconciliarCarrito,
  itemsParaPedido,
  explicarLinea,
  type Disponibilidad,
} from "@/lib/carrito/reconciliar";
import type { LineaCarrito, Variante } from "@/lib/types";

function linea(
  productoId: string,
  cantidad: number,
  tonoId: string | null = null
): LineaCarrito {
  return {
    productoId,
    tonoId,
    tonoNombre: tonoId ? `Tono ${tonoId}` : null,
    cantidad,
  };
}

const disponible = (id: string, stock: number, variantes: Variante[] = []): Disponibilidad => ({
  id,
  stock,
  activo: true,
  variantes,
});

const oculto = (id: string, stock: number): Disponibilidad => ({
  id,
  stock,
  activo: false,
  variantes: [],
});

describe("reconciliarCarrito", () => {
  it("deja pasar el carrito intacto cuando hay stock de sobra", () => {
    const r = reconciliarCarrito([linea("a", 2)], [disponible("a", 10)]);

    expect(r.hayCambios).toBe(false);
    expect(r.pedibles).toHaveLength(1);
    expect(r.pedibles[0].cantidad).toBe(2);
    expect(r.pedibles[0].estado).toBe("ok");
  });

  it("recorta la cantidad al stock que queda y lo marca como ajustada", () => {
    const r = reconciliarCarrito([linea("a", 5)], [disponible("a", 3)]);

    expect(r.lineas[0].estado).toBe("ajustada");
    expect(r.lineas[0].cantidad).toBe(3);
    expect(r.lineas[0].cantidadPedida).toBe(5);
    expect(r.hayCambios).toBe(true);
  });

  it("marca como agotada la línea de un producto en cero", () => {
    const r = reconciliarCarrito([linea("a", 2)], [disponible("a", 0)]);

    expect(r.lineas[0].estado).toBe("agotada");
    expect(r.pedibles).toHaveLength(0);
  });

  it("marca como no-disponible el producto oculto del catálogo", () => {
    const r = reconciliarCarrito([linea("a", 2)], [oculto("a", 99)]);

    expect(r.lineas[0].estado).toBe("no-disponible");
    expect(r.lineas[0].cantidad).toBe(0);
  });

  it("marca como no-disponible el producto que ya ni siquiera existe", () => {
    const r = reconciliarCarrito([linea("fantasma", 1)], []);

    expect(r.lineas[0].estado).toBe("no-disponible");
    expect(r.pedibles).toHaveLength(0);
  });

  it("reparte el stock compartido entre los tonos del mismo producto", () => {
    // Los tonos comparten inventario: 4 unidades pedidas, 3 en bodega.
    const r = reconciliarCarrito(
      [linea("a", 2, "rojo"), linea("a", 2, "nude")],
      [disponible("a", 3)]
    );

    expect(r.lineas[0].cantidad).toBe(2); // la primera se sirve completa
    expect(r.lineas[0].estado).toBe("ok");
    expect(r.lineas[1].cantidad).toBe(1); // la segunda con lo que queda
    expect(r.lineas[1].estado).toBe("ajustada");
  });

  it("deja en agotada el tono que se queda sin nada tras el reparto", () => {
    const r = reconciliarCarrito(
      [linea("a", 3, "rojo"), linea("a", 1, "nude")],
      [disponible("a", 3)]
    );

    expect(r.lineas[0].cantidad).toBe(3);
    expect(r.lineas[1].estado).toBe("agotada");
    expect(r.pedibles).toHaveLength(1);
  });

  it("no mezcla el stock entre productos distintos", () => {
    const r = reconciliarCarrito(
      [linea("a", 2), linea("b", 2)],
      [disponible("a", 2), disponible("b", 1)]
    );

    expect(r.lineas[0].estado).toBe("ok");
    expect(r.lineas[1].estado).toBe("ajustada");
    expect(r.lineas[1].cantidad).toBe(1);
  });

  it("conserva el orden original de las líneas", () => {
    const r = reconciliarCarrito(
      [linea("c", 1), linea("a", 1), linea("b", 1)],
      [disponible("a", 5), disponible("b", 5), disponible("c", 5)]
    );

    expect(r.lineas.map((l) => l.linea.productoId)).toEqual(["c", "a", "b"]);
  });

  it("trata un carrito vacío sin quejarse", () => {
    const r = reconciliarCarrito([], []);

    expect(r.lineas).toHaveLength(0);
    expect(r.hayCambios).toBe(false);
  });
});

// Bolsas guardadas por la v4: el panel viejo regeneraba los id de los tonos en cada guardado,
// así que un id guardado puede no existir aunque el tono sí.
describe("reconciliarCarrito · variantes", () => {
  const rojo: Variante = { id: "v-rojo", nombre: "Rojo", colorHex: "#c00000", orden: 1, agotado: false };
  const nude: Variante = { id: "v-nude", nombre: "Nude", colorHex: "#d8b49c", orden: 2, agotado: true };
  const conVariantes = (stock: number) => disponible("a", stock, [rojo, nude]);
  const guardada = (tonoId: string | null, tonoNombre: string | null, cantidad = 1): LineaCarrito => ({
    productoId: "a",
    tonoId,
    tonoNombre,
    cantidad,
  });

  it("recupera por nombre una variante cuyo id cambió y trae el id nuevo", () => {
    const r = reconciliarCarrito([guardada("id-viejo", "Rojo", 2)], [conVariantes(5)]);

    expect(r.lineas[0].estado).toBe("ok");
    expect(r.lineas[0].cantidad).toBe(2);
    expect(r.lineas[0].linea).toEqual({ productoId: "a", tonoId: "v-rojo", tonoNombre: "Rojo", cantidad: 2 });
  });

  it("conserva la línea tal como está guardada, para poder cambiarla en la bolsa", () => {
    const r = reconciliarCarrito([guardada("id-viejo", "Rojo", 2)], [conVariantes(5)]);
    expect(r.lineas[0].original.tonoId).toBe("id-viejo");
  });

  it("recupera el nombre aunque cambien mayúsculas o espacios", () => {
    const r = reconciliarCarrito([guardada("id-viejo", " ROJO ")], [conVariantes(5)]);

    expect(r.lineas[0].estado).toBe("ok");
    expect(r.lineas[0].linea.tonoId).toBe("v-rojo");
  });

  it("marca no-disponible una variante borrada", () => {
    const r = reconciliarCarrito([guardada("id-viejo", "Fucsia")], [conVariantes(5)]);

    expect(r.lineas[0].estado).toBe("no-disponible");
    expect(r.lineas[0].cantidad).toBe(0);
  });

  it("marca agotada la variante agotada sin gastar el stock de las demás", () => {
    const r = reconciliarCarrito(
      [guardada("v-nude", "Nude", 2), guardada("v-rojo", "Rojo", 5)],
      [conVariantes(5)]
    );

    expect(r.lineas[0].estado).toBe("agotada");
    expect(r.lineas[0].cantidad).toBe(0);
    expect(r.lineas[1].estado).toBe("ok");
    expect(r.lineas[1].cantidad).toBe(5);
  });

  it("pide elegir variante si el producto ahora tiene y la línea no trae", () => {
    const r = reconciliarCarrito([guardada(null, null)], [conVariantes(5)]);
    expect(r.lineas[0].estado).toBe("no-disponible");
  });

  it("manda al pedido el nombre actual de la variante recuperada", () => {
    const r = reconciliarCarrito([guardada("id-viejo", "rojo")], [conVariantes(5)]);
    expect(itemsParaPedido(r)).toEqual([{ producto_id: "a", cantidad: 1, tono: "Rojo" }]);
  });

  it("explica qué variante se agotó", () => {
    const r = reconciliarCarrito([guardada("v-nude", "Nude")], [conVariantes(5)]);
    const mensaje = explicarLinea(r.lineas[0], "Labial");

    expect(mensaje).toContain("Nude");
    expect(mensaje).toContain("se agotó");
  });
});

describe("itemsParaPedido", () => {
  it("manda exactamente lo que el carrito mostró, no lo que se pidió", () => {
    // Ésta es la regresión que importa: antes la pantalla recortaba a 3 y
    // el formulario enviaba 5, así que crear_pedido devolvía SIN_STOCK
    // por algo que la clienta ya no veía en pantalla.
    const r = reconciliarCarrito([linea("a", 5)], [disponible("a", 3)]);

    expect(itemsParaPedido(r)).toEqual([
      { producto_id: "a", cantidad: 3, tono: null },
    ]);
  });

  it("excluye las líneas que no se pueden pedir", () => {
    const r = reconciliarCarrito(
      [linea("a", 1), linea("b", 1), linea("c", 1)],
      [disponible("a", 5), disponible("b", 0), oculto("c", 9)]
    );

    expect(itemsParaPedido(r)).toEqual([
      { producto_id: "a", cantidad: 1, tono: null },
    ]);
  });

  it("conserva el nombre del tono para el snapshot del pedido", () => {
    const r = reconciliarCarrito([linea("a", 1, "rojo")], [disponible("a", 5)]);

    expect(itemsParaPedido(r)[0].tono).toBe("Tono rojo");
  });
});

describe("explicarLinea", () => {
  it("no dice nada de una línea que está bien", () => {
    const r = reconciliarCarrito([linea("a", 1)], [disponible("a", 5)]);
    expect(explicarLinea(r.lineas[0], "Labial")).toBeNull();
  });

  it("distingue agotado de retirado del catálogo", () => {
    const agotada = reconciliarCarrito([linea("a", 1)], [disponible("a", 0)]);
    const retirada = reconciliarCarrito([linea("a", 1)], [oculto("a", 5)]);

    expect(explicarLinea(agotada.lineas[0], "Labial")).toContain("se agotó");
    expect(explicarLinea(retirada.lineas[0], "Labial")).toContain("ya no está");
  });

  it("dice cuántas quedaron al ajustar", () => {
    const r = reconciliarCarrito([linea("a", 5)], [disponible("a", 2)]);
    const mensaje = explicarLinea(r.lineas[0], "Labial");

    expect(mensaje).toContain("2");
    expect(mensaje).toContain("5");
  });
});
