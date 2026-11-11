// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  guardarDatosCliente,
  guardarPedidoEnCelular,
  leerDatosCliente,
  leerPedidosGuardados,
  olvidarDatosCliente,
  pedidoReciente,
  type PedidoGuardado,
} from "@/lib/celular";

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse("2026-11-10T20:00:00.000Z");

function pedido(n: number, horasAtras = 0): PedidoGuardado {
  return {
    id: `id-${n}`,
    numero: `AB-${String(n).padStart(4, "0")}`,
    total: 10000 * n,
    fecha: new Date(AHORA - horasAtras * HORA).toISOString(),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("datos de la clienta", () => {
  it("guarda y lee los datos recordados", () => {
    const datos = { nombre: "María Gómez", whatsapp: "300 123 4567", ciudad: "Medellín" };
    guardarDatosCliente(datos);

    expect(leerDatosCliente()).toEqual(datos);
  });

  it("olvida los datos cuando se le pide", () => {
    guardarDatosCliente({ nombre: "María", whatsapp: "3001234567", ciudad: "Cali" });
    olvidarDatosCliente();

    expect(leerDatosCliente()).toBeNull();
  });

  it("ignora lo guardado si está dañado o incompleto", () => {
    localStorage.setItem("anaya-datos", "{no es json");
    expect(leerDatosCliente()).toBeNull();

    localStorage.setItem("anaya-datos", JSON.stringify({ nombre: "María" }));
    expect(leerDatosCliente()).toBeNull();
  });
});

describe("pedidos en este celular", () => {
  it("pone primero el más reciente", () => {
    guardarPedidoEnCelular(pedido(1));
    guardarPedidoEnCelular(pedido(2));

    expect(leerPedidosGuardados().map((p) => p.numero)).toEqual(["AB-0002", "AB-0001"]);
  });

  it("no duplica un pedido que se vuelve a guardar", () => {
    guardarPedidoEnCelular(pedido(1));
    guardarPedidoEnCelular(pedido(2));
    guardarPedidoEnCelular({ ...pedido(1), total: 99000 });

    const guardados = leerPedidosGuardados();
    expect(guardados.map((p) => p.id)).toEqual(["id-1", "id-2"]);
    expect(guardados[0].total).toBe(99000);
  });

  it("guarda como máximo 20 y suelta los más viejos", () => {
    for (let n = 1; n <= 25; n++) guardarPedidoEnCelular(pedido(n));

    const guardados = leerPedidosGuardados();
    expect(guardados).toHaveLength(20);
    expect(guardados[0].numero).toBe("AB-0025");
    expect(guardados[19].numero).toBe("AB-0006");
  });

  it("descarta entradas dañadas sin perder las buenas", () => {
    localStorage.setItem(
      "anaya-pedidos",
      JSON.stringify([pedido(1), { id: "x" }, "basura", pedido(2)])
    );

    expect(leerPedidosGuardados().map((p) => p.id)).toEqual(["id-1", "id-2"]);
  });
});

describe("pedidoReciente", () => {
  it("encuentra el pedido de hace 11 horas", () => {
    guardarPedidoEnCelular(pedido(7, 11));

    expect(pedidoReciente(12, AHORA)?.numero).toBe("AB-0007");
  });

  it("no cuenta un pedido de hace 13 horas", () => {
    guardarPedidoEnCelular(pedido(7, 13));

    expect(pedidoReciente(12, AHORA)).toBeNull();
  });

  it("elige el más reciente de la ventana", () => {
    guardarPedidoEnCelular(pedido(8, 2));
    guardarPedidoEnCelular(pedido(7, 9));

    expect(pedidoReciente(12, AHORA)?.numero).toBe("AB-0008");
  });
});

describe("almacenamiento bloqueado", () => {
  it("las lecturas no lanzan si el navegador niega el acceso", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(leerDatosCliente()).toBeNull();
    expect(leerPedidosGuardados()).toEqual([]);
    expect(pedidoReciente()).toBeNull();
  });

  it("las escrituras no lanzan si el almacenamiento está lleno", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => guardarDatosCliente({ nombre: "A", whatsapp: "3", ciudad: "B" })).not.toThrow();
    expect(() => guardarPedidoEnCelular(pedido(1))).not.toThrow();
  });
});
