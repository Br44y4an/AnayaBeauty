import { describe, it, expect } from "vitest";
import {
  enlaceClienta,
  estadoDeParametro,
  inicioDelDiaBogota,
  kpisDelDia,
  mensajeCobro,
  mensajeContacto,
  mensajeEnvio,
  mensajeErrorEstado,
  puedeCancelar,
  separarAdicional,
  siguientePaso,
} from "@/lib/admin/pedidos";
import type { Pedido } from "@/lib/types";

function pedido(cambios: Partial<Pedido> = {}): Pedido {
  return {
    id: "8a1f2c3d-0000-4000-8000-000000000001",
    numeroPedido: "AB-0098",
    clienteNombre: "maría josé pérez",
    clienteWhatsapp: "300 123 4567",
    clienteCiudad: "Medellín",
    notasCliente: null,
    subtotal: 45000,
    descuento: 0,
    porcentajeDescuento: 0,
    porMayor: false,
    total: 45000,
    estado: "nuevo",
    notasAdmin: null,
    creadoEn: "2026-11-10T20:00:00.000Z",
    lineas: [],
    ...cambios,
  };
}

const PAGO = { metodo: "Nequi", numero: "3001234567", titular: "Ana Pérez" };

describe("siguientePaso", () => {
  it("nuevo se confirma como pagado y pagado se marca enviado", () => {
    expect(siguientePaso("nuevo")).toEqual({ estado: "pagado", etiqueta: "Confirmar pago" });
    expect(siguientePaso("pagado")).toEqual({ estado: "enviado", etiqueta: "Marcar enviado" });
  });

  it("enviado y cancelado no tienen siguiente paso", () => {
    expect(siguientePaso("enviado")).toBeNull();
    expect(siguientePaso("cancelado")).toBeNull();
  });
});

describe("puedeCancelar", () => {
  it("solo antes de enviar (la base no permite enviado → cancelado)", () => {
    expect(puedeCancelar("nuevo")).toBe(true);
    expect(puedeCancelar("pagado")).toBe(true);
    expect(puedeCancelar("enviado")).toBe(false);
    expect(puedeCancelar("cancelado")).toBe(false);
  });
});

describe("mensajeCobro", () => {
  it("lleva el número del pedido, el total en pesos y los datos de pago completos", () => {
    const m = mensajeCobro(pedido(), PAGO);
    expect(m).toContain("AB-0098");
    expect(m).toContain("$45.000");
    expect(m).toContain("Nequi");
    expect(m).toContain("3001234567");
    expect(m).toContain("Ana Pérez");
  });

  it("saluda por el primer nombre con mayúscula y sin emoji ni exclamaciones", () => {
    const m = mensajeCobro(pedido(), PAGO);
    expect(m.startsWith("Hola, María.")).toBe(true);
    expect(m).not.toMatch(/[!¡]/);
    expect(m).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("sin datos de pago no deja huecos ni «null»", () => {
    const m = mensajeCobro(pedido(), { metodo: null, numero: null, titular: null });
    expect(m).toContain("AB-0098");
    expect(m).toContain("$45.000");
    expect(m).not.toMatch(/null|undefined|NaN/);
    expect(m).toContain("datos de pago");
  });

  it("con número pero sin método ni titular arma una frase completa", () => {
    const m = mensajeCobro(pedido(), { metodo: null, numero: "3001234567", titular: null });
    expect(m).toContain("3001234567");
    expect(m).not.toMatch(/null|undefined| ,|  /);
  });

  it("un nombre vacío no deja «Hola, .»", () => {
    expect(mensajeCobro(pedido({ clienteNombre: "  " }), PAGO).startsWith("Hola.")).toBe(true);
  });
});

describe("mensajeEnvio", () => {
  it("avisa el despacho con el número del pedido", () => {
    const m = mensajeEnvio(pedido({ estado: "enviado" }));
    expect(m).toContain("AB-0098");
    expect(m.startsWith("Hola, María.")).toBe(true);
    expect(m).not.toMatch(/[!¡]/);
  });
});

describe("mensajeContacto", () => {
  it("abre la conversación nombrando el pedido", () => {
    expect(mensajeContacto(pedido())).toBe(
      "Hola, María. Te escribo de Anaya Beauty por tu pedido AB-0098."
    );
  });
});

describe("estadoDeParametro", () => {
  it("solo acepta los cuatro estados; lo demás es «Todos»", () => {
    expect(estadoDeParametro("pagado")).toBe("pagado");
    expect(estadoDeParametro("todos")).toBeUndefined();
    expect(estadoDeParametro("PAGADO")).toBeUndefined();
    expect(estadoDeParametro(undefined)).toBeUndefined();
  });
});

describe("enlaceClienta", () => {
  it("abre WhatsApp con el número de la clienta normalizado y el mensaje", () => {
    expect(enlaceClienta("300 123 4567", "Hola")).toBe("https://wa.me/573001234567?text=Hola");
    expect(enlaceClienta("+57 300-123-4567", "a b")).toBe("https://wa.me/573001234567?text=a%20b");
  });

  it("un número que no es de celular no cae en el WhatsApp del negocio", () => {
    expect(enlaceClienta("604 444 1234", "Hola")).toBeNull();
    expect(enlaceClienta("", "Hola")).toBeNull();
  });
});

describe("inicioDelDiaBogota", () => {
  it("a las 10:30 p. m. de Bogotá (03:30 UTC del día siguiente) el día empezó a las 5:00 UTC", () => {
    expect(inicioDelDiaBogota(new Date("2026-11-11T03:30:00Z")).toISOString()).toBe(
      "2026-11-10T05:00:00.000Z"
    );
  });

  it("justo a medianoche de Bogotá empieza el día nuevo", () => {
    expect(inicioDelDiaBogota(new Date("2026-11-11T05:00:00Z")).toISOString()).toBe(
      "2026-11-11T05:00:00.000Z"
    );
    expect(inicioDelDiaBogota(new Date("2026-11-11T04:59:59Z")).toISOString()).toBe(
      "2026-11-10T05:00:00.000Z"
    );
  });
});

describe("kpisDelDia", () => {
  const ahora = new Date("2026-11-11T03:30:00Z"); // 10:30 p. m. del 10-nov en Bogotá

  it("cuenta solo el día de Bogotá y excluye los cancelados de lo vendido", () => {
    const k = kpisDelDia(
      [
        { creadoEn: "2026-11-10T14:00:00Z", total: 30000, estado: "nuevo" },
        { creadoEn: "2026-11-11T02:00:00Z", total: 20000, estado: "pagado" },
        { creadoEn: "2026-11-11T01:00:00Z", total: 50000, estado: "cancelado" },
        { creadoEn: "2026-11-10T04:00:00Z", total: 99000, estado: "nuevo" }, // 9-nov en Bogotá
      ],
      ahora
    );
    expect(k).toEqual({ pedidos: 2, vendido: 50000, porCobrar: 30000 });
  });

  it("sin pedidos todo es cero", () => {
    expect(kpisDelDia([], ahora)).toEqual({ pedidos: 0, vendido: 0, porCobrar: 0 });
  });
});

describe("mensajeErrorEstado", () => {
  it("traduce los errores de cambiar_estado_pedido a texto amable", () => {
    expect(
      mensajeErrorEstado({ message: "TRANSICION_INVALIDA", details: "enviado -> cancelado" })
    ).toBe("Un pedido enviado ya no se puede cancelar.");
    expect(mensajeErrorEstado({ message: "TRANSICION_INVALIDA", details: "cancelado -> pagado" })).toBe(
      "Este pedido está cancelado: ya no cambia de estado."
    );
    expect(mensajeErrorEstado({ message: "PEDIDO_NO_ENCONTRADO" })).toBe("Este pedido ya no existe.");
    expect(mensajeErrorEstado({ message: "fetch failed" })).toBe(
      "No se pudo guardar el cambio. Revisa tu conexión e inténtalo otra vez."
    );
  });

  it("nunca muestra el código técnico", () => {
    const m = mensajeErrorEstado({ message: "TRANSICION_INVALIDA", details: "nuevo -> nuevo" });
    expect(m).not.toMatch(/TRANSICION|->/);
  });
});

describe("separarAdicional", () => {
  it("separa el pedido al que se suma del resto de la nota", () => {
    expect(separarAdicional("[Adicional a AB-0097] Es un regalo")).toEqual({
      adicionalA: "AB-0097",
      nota: "Es un regalo",
    });
    expect(separarAdicional("[Adicional a AB-0097]")).toEqual({ adicionalA: "AB-0097", nota: null });
  });

  it("una nota normal o vacía queda igual", () => {
    expect(separarAdicional("Llamar antes")).toEqual({ adicionalA: null, nota: "Llamar antes" });
    expect(separarAdicional(null)).toEqual({ adicionalA: null, nota: null });
  });
});
