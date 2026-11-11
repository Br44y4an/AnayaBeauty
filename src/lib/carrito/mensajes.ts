export type CampoConProblema = "nombre" | "whatsapp" | "ciudad" | "bolsa";

const CODIGOS = [
  "DEMASIADOS_PEDIDOS",
  "SIN_STOCK",
  "PRODUCTO_NO_DISPONIBLE",
  "SIN_PRECIO",
  "TONO_NO_DISPONIBLE",
  "PEDIDO_MUY_GRANDE",
  "CARRITO_VACIO",
  "DATOS_INCOMPLETOS",
] as const;

/**
 * Traduce un código de error a lo que la clienta tiene que hacer. Acepta el
 * código suelto o el mensaje crudo de la base («SIN_STOCK|Labial|2»).
 */
export function mensajeAmable(
  codigo: string,
  detalle?: string
): { mensaje: string; campo?: CampoConProblema } {
  const [primero, nombreCrudo, cantidad] = codigo.split("|").map((p) => p.trim());
  const clave = CODIGOS.find((c) => c === primero) ?? CODIGOS.find((c) => codigo.includes(c));
  const nombre = (detalle ?? nombreCrudo ?? "").trim();

  switch (clave) {
    case "DEMASIADOS_PEDIDOS":
      return {
        mensaje:
          "Recibimos varios pedidos desde este celular en pocos minutos. " +
          "Espera 10 minutos o escríbenos por WhatsApp.",
      };
    case "SIN_STOCK": {
      let mensaje = `De ${nombre} no quedan suficientes unidades. Ajusta la cantidad y confirma de nuevo.`;
      if (!nombre) mensaje = "Algo de tu bolsa se agotó. Revísala y confirma de nuevo.";
      else if (cantidad && Number(cantidad) <= 0) mensaje = `${nombre} se agotó. Quítalo de tu bolsa y confirma de nuevo.`;
      else if (cantidad) mensaje = `De ${nombre} solo quedan ${cantidad}. Ajusta la cantidad y confirma de nuevo.`;
      return { campo: "bolsa", mensaje };
    }
    case "PRODUCTO_NO_DISPONIBLE":
      return {
        campo: "bolsa",
        mensaje: nombre
          ? `${nombre} ya no está disponible. Quítalo de tu bolsa para continuar.`
          : "Un producto de tu bolsa ya no está disponible. Revísala.",
      };
    case "SIN_PRECIO":
      return {
        campo: "bolsa",
        mensaje: `${nombre || "Un producto de tu bolsa"} aún no tiene precio. Quítalo de la bolsa o pregúntanos por WhatsApp.`,
      };
    case "TONO_NO_DISPONIBLE":
      return {
        campo: "bolsa",
        mensaje: `Una opción que elegiste${nombre ? ` de ${nombre}` : ""} ya no está disponible. Revisa tu bolsa y confirma de nuevo.`,
      };
    case "PEDIDO_MUY_GRANDE":
      return { campo: "bolsa", mensaje: "Para pedidos tan grandes escríbenos por WhatsApp." };
    case "CARRITO_VACIO":
      return { campo: "bolsa", mensaje: "Tu bolsa está vacía." };
    case "DATOS_INCOMPLETOS":
      return { mensaje: "Completa nombre, WhatsApp y ciudad." };
    default:
      return {
        mensaje:
          "No pudimos confirmar tu pedido. Intenta de nuevo en un momento o escríbenos por WhatsApp.",
      };
  }
}
