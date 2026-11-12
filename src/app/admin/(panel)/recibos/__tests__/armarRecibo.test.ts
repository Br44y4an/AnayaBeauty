import { describe, it, expect } from "vitest";
import type { Pedido, Producto } from "@/lib/types";
import { armarRecibo, type ContextoRecibo } from "../armarRecibo";
import { estadoInicial, reducirRecibo, type AccionRecibo, type EstadoRecibo } from "../estadoRecibo";

const PEDIDO: Pedido = {
  id: "p1",
  numeroPedido: "AB-0100",
  clienteNombre: "Gloria Cárdenas",
  clienteWhatsapp: "3105551234",
  clienteCiudad: "Pereira",
  notasCliente: null,
  subtotal: 100000,
  descuento: 5000,
  porcentajeDescuento: 5,
  porMayor: false,
  total: 95000,
  estado: "pagado",
  notasAdmin: null,
  creadoEn: "2026-11-01T20:00:00.000Z",
  lineas: [
    { id: "l1", referencia: "AC80/150", nombre: "Espejo de mano", tono: null, cantidad: 4, precioUnitarioAplicado: 25000, subtotal: 100000 },
  ],
};

const LABIAL = {
  id: "lab",
  referencia: "GLS735",
  nombre: "Brillo labial",
  escalones: [
    { minCantidad: 1, precioUnitario: 8000 },
    { minCantidad: 3, precioUnitario: 7500 },
  ],
  variantes: [],
} as unknown as Producto;

const CONTEXTO: ContextoRecibo = {
  pedidos: [PEDIDO],
  productos: [LABIAL],
  reglas: [{ montoMinimo: 20000, porcentaje: 10 }],
  umbralPorMayor: 500000,
  pago: { metodo: "Nequi", numero: "3228813646", titular: "Anaya Beauty" },
};

function con(...acciones: AccionRecibo[]): EstadoRecibo {
  return acciones.reduce(reducirRecibo, estadoInicial({ pedidoId: "", hoy: "2026-11-10", numero: "REC-20261110-123" }));
}

const ENVIO: AccionRecibo = {
  tipo: "guardarTexto",
  linea: { id: "t1", descripcion: "Envío", cantidad: 2, precioUnitario: 6000 },
};

describe("armarRecibo desde un pedido", () => {
  it("toma los datos del pedido y suma el envío después del descuento", () => {
    const r = armarRecibo(con({ tipo: "elegirPedido", id: "p1" }, ENVIO), CONTEXTO);

    expect(r.datos.numero).toBe("AB-0100");
    expect(r.datos.destinatario.nombre).toBe("Gloria Cárdenas");
    expect(r.destinatarioEditado).toBe(false);
    expect(r.datos.lineas.map((l) => [l.referencia ?? null, l.nombre, l.subtotal])).toEqual([
      ["AC80/150", "Espejo de mano", 100000],
      [null, "Envío", 12000],
    ]);
    expect([r.datos.subtotal, r.datos.descuento, r.datos.porcentaje, r.datos.total]).toEqual([112000, 5000, 5, 107000]);
    expect(r.falta).toBeNull();
  });

  it("el recibo puede ir a nombre de otra persona sin tocar el pedido", () => {
    const base = armarRecibo(con({ tipo: "elegirPedido", id: "p1" }), CONTEXTO).datos.destinatario;
    const estado = con(
      { tipo: "elegirPedido", id: "p1" },
      { tipo: "destinatario", campo: "nombre", valor: "Distribuidora Luna SAS", base }
    );
    const r = armarRecibo(estado, CONTEXTO);
    expect(r.datos.destinatario).toMatchObject({ nombre: "Distribuidora Luna SAS", ciudad: "Pereira" });
    expect(r.destinatarioEditado).toBe(true);

    const vuelta = armarRecibo(reducirRecibo(estado, { tipo: "restaurarDestinatario" }), CONTEXTO);
    expect(vuelta.datos.destinatario.nombre).toBe("Gloria Cárdenas");
  });

  it("un descuento cambiado a mano ya no dice el porcentaje; oculto, no sale pero el total lo respeta", () => {
    const manual = armarRecibo(con({ tipo: "elegirPedido", id: "p1" }, { tipo: "descuento", valor: 8000 }), CONTEXTO);
    expect([manual.datos.descuento, manual.datos.porcentaje, manual.datos.total]).toEqual([8000, 0, 92000]);

    const oculto = armarRecibo(con({ tipo: "elegirPedido", id: "p1" }, { tipo: "mostrarDescuento", valor: false }), CONTEXTO);
    expect([oculto.datos.descuento, oculto.datos.total]).toEqual([0, 95000]);
  });

  it("sin pedido pide elegir uno", () => {
    expect(armarRecibo(con(), CONTEXTO).falta).toBe("Elige un pedido.");
  });
});

describe("armarRecibo manual", () => {
  it("cobra con escalones y reglas como la tienda, y el texto no recibe descuento", () => {
    const r = armarRecibo(
      con(
        { tipo: "modo", modo: "manual" },
        { tipo: "agregarCatalogo", linea: { productoId: "lab", tonoId: null, tonoNombre: null, cantidad: 3 } },
        ENVIO,
        { tipo: "destinatario", campo: "nombre", valor: "Ana", base: estadoInicial({ pedidoId: "", hoy: "", numero: "" }).manual.destinatario }
      ),
      CONTEXTO
    );

    expect(r.datos.numero).toBe("REC-20261110-123");
    expect(r.lineasCatalogo[0]).toMatchObject({ precioUnitario: 7500, subtotal: 22500 });
    // 10 % de 22.500 = 2.250; el envío de 12.000 se suma entero.
    expect([r.datos.subtotal, r.datos.descuento, r.datos.porcentaje, r.datos.total]).toEqual([34500, 2250, 10, 32250]);
    expect(r.falta).toBeNull();
  });

  it("explica qué falta antes de dejar descargar", () => {
    expect(armarRecibo(con({ tipo: "modo", modo: "manual" }), CONTEXTO).falta).toBe(
      "Falta el nombre en «Dirigido a» y agregar al menos un producto."
    );
  });
});
