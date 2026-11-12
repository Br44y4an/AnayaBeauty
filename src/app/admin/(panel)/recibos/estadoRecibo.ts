import {
  DESTINATARIO_VACIO,
  PREFERENCIAS_POR_DEFECTO,
  type Destinatario,
  type LineaTexto,
  type PreferenciasRecibo,
} from "@/lib/admin/recibo";

/** Estado del constructor de recibos y su reductor. Nada de esto se guarda en la base. */

export type Modo = "pedido" | "manual";
export type LineaCatalogo = { productoId: string; tonoId: string | null; tonoNombre: string | null; cantidad: number };

type Ajustes = {
  numero: string | null;
  /** Precio unitario cambiado a mano, por línea. */
  precios: Record<string, number>;
  /** null = el descuento calculado (el del pedido o el de las reglas). */
  descuento: number | null;
  mostrarDescuento: boolean;
  lineasTexto: LineaTexto[];
};

export type EstadoRecibo = {
  modo: Modo;
  fecha: string;
  preferencias: PreferenciasRecibo;
  preferenciasCargadas: boolean;
  /** Desde un pedido, `destinatario` null = los datos del pedido; `numero` null = su número. */
  pedido: Ajustes & { id: string; destinatario: Destinatario | null };
  manual: Ajustes & { numero: string; destinatario: Destinatario; lineas: LineaCatalogo[] };
};

export type AccionRecibo =
  | { tipo: "modo"; modo: Modo }
  | { tipo: "elegirPedido"; id: string }
  | { tipo: "destinatario"; campo: keyof Destinatario; valor: string; base: Destinatario }
  | { tipo: "restaurarDestinatario" }
  | { tipo: "numero"; valor: string }
  | { tipo: "fecha"; valor: string }
  | { tipo: "preferencias"; cambios: Partial<PreferenciasRecibo> }
  | { tipo: "cargarPreferencias"; preferencias: PreferenciasRecibo }
  | { tipo: "restablecerPreferencias" }
  | { tipo: "precio"; clave: string; valor: number }
  | { tipo: "descuento"; valor: number | null }
  | { tipo: "mostrarDescuento"; valor: boolean }
  | { tipo: "agregarCatalogo"; linea: LineaCatalogo }
  | { tipo: "cantidadCatalogo"; productoId: string; tonoId: string | null; cantidad: number }
  | { tipo: "guardarTexto"; linea: LineaTexto }
  | { tipo: "quitarTexto"; id: string };

const AJUSTES_VACIOS = { precios: {}, descuento: null, mostrarDescuento: true, lineasTexto: [] };

export function estadoInicial(o: { pedidoId: string; hoy: string; numero: string }): EstadoRecibo {
  return {
    modo: "pedido",
    fecha: o.hoy,
    preferencias: PREFERENCIAS_POR_DEFECTO,
    preferenciasCargadas: false,
    pedido: { ...AJUSTES_VACIOS, id: o.pedidoId, numero: null, destinatario: null },
    manual: { ...AJUSTES_VACIOS, numero: o.numero, destinatario: DESTINATARIO_VACIO, lineas: [] },
  };
}

export const claveCatalogo = (productoId: string, tonoId: string | null) => `${productoId}-${tonoId ?? "sin"}`;

function enModo(e: EstadoRecibo, cambio: (a: Ajustes) => Partial<Omit<Ajustes, "numero">>): EstadoRecibo {
  return e.modo === "pedido"
    ? { ...e, pedido: { ...e.pedido, ...cambio(e.pedido) } }
    : { ...e, manual: { ...e.manual, ...cambio(e.manual) } };
}

export function reducirRecibo(e: EstadoRecibo, a: AccionRecibo): EstadoRecibo {
  switch (a.tipo) {
    case "modo":
      return { ...e, modo: a.modo };
    case "elegirPedido":
      // Lo que venía del pedido anterior se descarta; los productos en texto se quedan.
      return {
        ...e,
        pedido: { ...AJUSTES_VACIOS, id: a.id, numero: null, destinatario: null, lineasTexto: e.pedido.lineasTexto },
      };
    case "destinatario":
      if (e.modo === "pedido") {
        const actual = e.pedido.destinatario ?? a.base;
        return { ...e, pedido: { ...e.pedido, destinatario: { ...actual, [a.campo]: a.valor } } };
      }
      return { ...e, manual: { ...e.manual, destinatario: { ...e.manual.destinatario, [a.campo]: a.valor } } };
    case "restaurarDestinatario":
      return { ...e, pedido: { ...e.pedido, destinatario: null } };
    case "numero":
      return e.modo === "pedido"
        ? { ...e, pedido: { ...e.pedido, numero: a.valor } }
        : { ...e, manual: { ...e.manual, numero: a.valor } };
    case "fecha":
      return { ...e, fecha: a.valor };
    case "preferencias":
      return { ...e, preferencias: { ...e.preferencias, ...a.cambios } };
    case "cargarPreferencias":
      return { ...e, preferencias: a.preferencias, preferenciasCargadas: true };
    case "restablecerPreferencias":
      return { ...e, preferencias: PREFERENCIAS_POR_DEFECTO };
    case "precio":
      return enModo(e, (m) => ({ precios: { ...m.precios, [a.clave]: a.valor } }));
    case "descuento":
      return enModo(e, () => ({ descuento: a.valor }));
    case "mostrarDescuento":
      return enModo(e, () => ({ mostrarDescuento: a.valor }));
    case "agregarCatalogo": {
      const { linea } = a;
      const existe = e.manual.lineas.some((l) => l.productoId === linea.productoId && l.tonoId === linea.tonoId);
      const lineas = existe
        ? e.manual.lineas.map((l) =>
            l.productoId === linea.productoId && l.tonoId === linea.tonoId
              ? { ...l, cantidad: l.cantidad + linea.cantidad }
              : l
          )
        : [...e.manual.lineas, linea];
      return { ...e, manual: { ...e.manual, lineas } };
    }
    case "cantidadCatalogo": {
      const esta = (l: LineaCatalogo) => l.productoId === a.productoId && l.tonoId === a.tonoId;
      const lineas =
        a.cantidad < 1
          ? e.manual.lineas.filter((l) => !esta(l))
          : e.manual.lineas.map((l) => (esta(l) ? { ...l, cantidad: a.cantidad } : l));
      return { ...e, manual: { ...e.manual, lineas } };
    }
    case "guardarTexto":
      return enModo(e, (m) => ({
        lineasTexto: m.lineasTexto.some((l) => l.id === a.linea.id)
          ? m.lineasTexto.map((l) => (l.id === a.linea.id ? a.linea : l))
          : [...m.lineasTexto, a.linea],
      }));
    case "quitarTexto":
      return enModo(e, (m) => ({ lineasTexto: m.lineasTexto.filter((l) => l.id !== a.id) }));
  }
}
