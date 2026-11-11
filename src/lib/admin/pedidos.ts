import { pesos } from "@/lib/format";
import { enlaceWhatsApp, normalizarWhatsapp } from "@/lib/whatsapp";
import type { ConfiguracionPublica, EstadoPedido, Pedido } from "@/lib/types";

export const ESTADOS: readonly EstadoPedido[] = ["nuevo", "pagado", "enviado", "cancelado"];

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  pagado: "Pagado",
  enviado: "Enviado",
  cancelado: "Cancelado",
};

/** `?estado=` llega de la URL: cualquier otro valor es «Todos». */
export function estadoDeParametro(valor: string | null | undefined): EstadoPedido | undefined {
  return ESTADOS.find((e) => e === valor);
}

/** El botón principal de la tarjeta. Las correcciones (pagado → nuevo, enviado → pagado) van por «Deshacer». */
export function siguientePaso(estado: EstadoPedido): { estado: EstadoPedido; etiqueta: string } | null {
  if (estado === "nuevo") return { estado: "pagado", etiqueta: "Confirmar pago" };
  if (estado === "pagado") return { estado: "enviado", etiqueta: "Marcar enviado" };
  return null;
}

/** `cambiar_estado_pedido` no permite cancelar lo enviado, y cancelado es final. */
export function puedeCancelar(estado: EstadoPedido): boolean {
  return estado === "nuevo" || estado === "pagado";
}

function saludo(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0]?.toLocaleLowerCase("es") ?? "";
  if (!primero) return "Hola.";
  return `Hola, ${primero.charAt(0).toLocaleUpperCase("es")}${primero.slice(1)}.`;
}

/** Para escribirle sin un mensaje de cobro o de envío (pedido pagado o cancelado). */
export function mensajeContacto(p: Pedido): string {
  return `${saludo(p.clienteNombre)} Te escribo de Anaya Beauty por tu pedido ${p.numeroPedido}.`;
}

export function mensajeCobro(p: Pedido, pago: ConfiguracionPublica["pago"]): string {
  const comoPagar = pago.numero
    ? `Puedes pagar${pago.metodo ? ` por ${pago.metodo}` : ""} al ${pago.numero}` +
      `${pago.titular ? `, a nombre de ${pago.titular}` : ""}.`
    : "En un momento te envío los datos de pago.";

  return [
    mensajeContacto(p),
    `Total: ${pesos(p.total)}.`,
    comoPagar,
    "Cuando pagues, envíame el comprobante por aquí.",
  ].join("\n");
}

export function mensajeEnvio(p: Pedido): string {
  return [
    `${saludo(p.clienteNombre)} Tu pedido ${p.numeroPedido} ya va en camino.`,
    "Gracias por comprar en Anaya Beauty.",
  ].join("\n");
}

/** null si el número no es un celular válido: `enlaceWhatsApp` caería en el número del negocio. */
export function enlaceClienta(whatsapp: string, mensaje: string): string | null {
  const numero = normalizarWhatsapp(whatsapp);
  return numero ? enlaceWhatsApp(mensaje, numero) : null;
}

const HORA = 3_600_000;
const DIA = 24 * HORA;
// Colombia no cambia de hora: Bogotá es UTC−5 todo el año.
const DESFASE_BOGOTA = 5 * HORA;

export function inicioDelDiaBogota(ahora: Date): Date {
  const local = ahora.getTime() - DESFASE_BOGOTA;
  return new Date(Math.floor(local / DIA) * DIA + DESFASE_BOGOTA);
}

/** Los cancelados no cuentan como pedidos ni como venta; «por cobrar» son los nuevos del día. */
export function kpisDelDia(
  pedidos: Pick<Pedido, "creadoEn" | "total" | "estado">[],
  ahora: Date
): { pedidos: number; vendido: number; porCobrar: number } {
  const inicio = inicioDelDiaBogota(ahora).getTime();
  const delDia = pedidos.filter((p) => {
    const creado = Date.parse(p.creadoEn);
    return creado >= inicio && creado < inicio + DIA && p.estado !== "cancelado";
  });

  return {
    pedidos: delDia.length,
    vendido: delDia.reduce((suma, p) => suma + p.total, 0),
    porCobrar: delDia.filter((p) => p.estado === "nuevo").reduce((suma, p) => suma + p.total, 0),
  };
}

/** Errores de `cambiar_estado_pedido` (código en `message`, «actual -> pedido» en `details`). */
/** Sin respuesta del servidor (red caída) o un fallo que no es de la regla de estados. */
export const SIN_CONEXION_ESTADO = "No se pudo guardar el cambio. Revisa tu conexión e inténtalo otra vez.";

export function mensajeErrorEstado(error: { message: string; details?: string | null }): string {
  if (error.message.includes("PEDIDO_NO_ENCONTRADO")) return "Este pedido ya no existe.";
  if (error.message.includes("TRANSICION_INVALIDA")) {
    const [actual, pedido] = (error.details ?? "").split("->").map((s) => s.trim());
    if (actual === "cancelado") return "Este pedido está cancelado: ya no cambia de estado.";
    if (actual === "enviado" && pedido === "cancelado") return "Un pedido enviado ya no se puede cancelar.";
    return "Este pedido cambió de estado en otra pantalla. Revisa cómo quedó.";
  }
  return SIN_CONEXION_ESTADO;
}

const ADICIONAL = /^\[Adicional a ([^\]]+)\]\s*/;

/** `confirmarPedido` antepone «[Adicional a AB-xxxx] » a la nota; el panel lo muestra aparte. */
export function separarAdicional(nota: string | null): { adicionalA: string | null; nota: string | null } {
  const coincidencia = nota?.match(ADICIONAL);
  if (!nota || !coincidencia) return { adicionalA: null, nota: nota?.trim() || null };
  return { adicionalA: coincidencia[1], nota: nota.slice(coincidencia[0].length).trim() || null };
}
