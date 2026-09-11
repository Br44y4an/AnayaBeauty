import { describe, it, expect, beforeEach } from "vitest";
import { usarCarrito, totalUnidades, unidadesDeProducto } from "@/lib/cart";

const CEREZA = { id: "t1", nombre: "Cereza" };
const VINO = { id: "t2", nombre: "Vino" };

describe("carrito", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("agrega un producto sin tono", () => {
    usarCarrito.getState().agregar("p1", 2);
    expect(usarCarrito.getState().lineas).toEqual([
      { productoId: "p1", tonoId: null, tonoNombre: null, cantidad: 2 },
    ]);
  });

  it("suma la cantidad si el producto y el tono coinciden", () => {
    usarCarrito.getState().agregar("p1", 2, CEREZA);
    usarCarrito.getState().agregar("p1", 3, CEREZA);
    expect(usarCarrito.getState().lineas).toHaveLength(1);
    expect(usarCarrito.getState().lineas[0].cantidad).toBe(5);
  });

  it("separa en líneas distintas dos tonos del mismo producto", () => {
    usarCarrito.getState().agregar("p1", 2, CEREZA);
    usarCarrito.getState().agregar("p1", 1, VINO);

    const lineas = usarCarrito.getState().lineas;
    expect(lineas).toHaveLength(2);
    expect(lineas[0].tonoNombre).toBe("Cereza");
    expect(lineas[1].tonoNombre).toBe("Vino");
  });

  it("no confunde el producto sin tono con el mismo producto con tono", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    expect(usarCarrito.getState().lineas).toHaveLength(2);
  });

  it("guarda el nombre del tono para poder mostrarlo sin volver a consultar", () => {
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    expect(usarCarrito.getState().lineas[0].tonoNombre).toBe("Cereza");
  });

  it("establece la cantidad de un tono concreto", () => {
    usarCarrito.getState().agregar("p1", 5, CEREZA);
    usarCarrito.getState().agregar("p1", 5, VINO);
    usarCarrito.getState().establecer("p1", "t1", 2);

    const lineas = usarCarrito.getState().lineas;
    expect(lineas.find((l) => l.tonoId === "t1")?.cantidad).toBe(2);
    expect(lineas.find((l) => l.tonoId === "t2")?.cantidad).toBe(5);
  });

  it("elimina la línea si la cantidad baja a cero", () => {
    usarCarrito.getState().agregar("p1", 3, CEREZA);
    usarCarrito.getState().establecer("p1", "t1", 0);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });

  it("quita solo el tono indicado", () => {
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    usarCarrito.getState().agregar("p1", 1, VINO);
    usarCarrito.getState().quitar("p1", "t1");

    expect(usarCarrito.getState().lineas).toHaveLength(1);
    expect(usarCarrito.getState().lineas[0].tonoId).toBe("t2");
  });

  it("cuenta el total de unidades sumando todas las líneas", () => {
    usarCarrito.getState().agregar("p1", 3, CEREZA);
    usarCarrito.getState().agregar("p2", 4);
    expect(totalUnidades(usarCarrito.getState())).toBe(7);
  });

  it("suma las unidades de un producto a través de sus tonos", () => {
    usarCarrito.getState().agregar("p1", 3, CEREZA);
    usarCarrito.getState().agregar("p1", 2, VINO);
    usarCarrito.getState().agregar("p2", 9);

    // Importante para el stock: los tonos comparten inventario
    expect(unidadesDeProducto(usarCarrito.getState().lineas, "p1")).toBe(5);
  });

  it("vaciar borra las líneas y la clave de envío", () => {
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    usarCarrito.getState().prepararEnvio();
    usarCarrito.getState().vaciar();

    expect(usarCarrito.getState().lineas).toEqual([]);
    expect(usarCarrito.getState().claveEnvio).toBeNull();
  });
});

describe("clave de envío (reintento seguro)", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("devuelve la MISMA clave mientras la bolsa no cambie", () => {
    // Es lo que hace que un doble toque en "Confirmar" no cree dos
    // pedidos: la segunda llamada llega con la misma clave y el servidor
    // devuelve el pedido que ya creó.
    usarCarrito.getState().agregar("p1", 1, CEREZA);

    const primera = usarCarrito.getState().prepararEnvio();
    const segunda = usarCarrito.getState().prepararEnvio();

    expect(primera).toBe(segunda);
    expect(primera).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("renueva la clave en cuanto la bolsa cambia", () => {
    // Si la clienta vuelve atrás y agrega algo más, ese pedido es otro
    // pedido: reusar la clave devolvería el anterior sin lo nuevo.
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    const primera = usarCarrito.getState().prepararEnvio();

    usarCarrito.getState().agregar("p2", 1);
    expect(usarCarrito.getState().claveEnvio).toBeNull();

    const segunda = usarCarrito.getState().prepararEnvio();
    expect(segunda).not.toBe(primera);
  });

  it("también se renueva al cambiar cantidades o quitar líneas", () => {
    usarCarrito.getState().agregar("p1", 2, CEREZA);

    usarCarrito.getState().prepararEnvio();
    usarCarrito.getState().establecer("p1", "t1", 3);
    expect(usarCarrito.getState().claveEnvio).toBeNull();

    usarCarrito.getState().prepararEnvio();
    usarCarrito.getState().quitar("p1", "t1");
    expect(usarCarrito.getState().claveEnvio).toBeNull();
  });
});

describe("identidad de las líneas (rendimiento)", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("conserva la referencia de las líneas que no se tocan", () => {
    // De esto depende que la tarjeta de un producto NO se vuelva a
    // pintar cuando cambia otro: useShallow compara por referencia.
    usarCarrito.getState().agregar("p1", 1, CEREZA);
    usarCarrito.getState().agregar("p2", 1);

    const antes = usarCarrito.getState().lineas.find((l) => l.productoId === "p2");
    usarCarrito.getState().establecer("p1", "t1", 5);
    const despues = usarCarrito.getState().lineas.find((l) => l.productoId === "p2");

    expect(despues).toBe(antes);
  });

  it("ignora cantidades inválidas", () => {
    usarCarrito.getState().agregar("p1", 0, CEREZA);
    usarCarrito.getState().agregar("p2", -3);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });
});
