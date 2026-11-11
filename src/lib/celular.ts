/**
 * Lo que este celular recuerda de la clienta. El almacenamiento puede estar
 * bloqueado (modo privado, datos borrados): nada de aquí lanza.
 */

export type DatosCliente = { nombre: string; whatsapp: string; ciudad: string };
export type PedidoGuardado = { id: string; numero: string; total: number; fecha: string };

const CLAVE_DATOS = "anaya-datos";
const CLAVE_PEDIDOS = "anaya-pedidos";
const MAX_PEDIDOS = 20;
const HORA = 60 * 60 * 1000;

function leer(clave: string): unknown {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin espacio o sin permiso: recordar es un extra, no puede romper la compra.
  }
}

const esTexto = (v: unknown): v is string => typeof v === "string";

function esDatosCliente(v: unknown): v is DatosCliente {
  const d = v as Partial<DatosCliente> | null;
  return !!d && esTexto(d.nombre) && esTexto(d.whatsapp) && esTexto(d.ciudad);
}

function esPedidoGuardado(v: unknown): v is PedidoGuardado {
  const p = v as Partial<PedidoGuardado> | null;
  return (
    !!p &&
    esTexto(p.id) &&
    esTexto(p.numero) &&
    esTexto(p.fecha) &&
    typeof p.total === "number" &&
    Number.isFinite(p.total)
  );
}

export function leerDatosCliente(): DatosCliente | null {
  const datos = leer(CLAVE_DATOS);
  return esDatosCliente(datos)
    ? { nombre: datos.nombre, whatsapp: datos.whatsapp, ciudad: datos.ciudad }
    : null;
}

export function guardarDatosCliente(d: DatosCliente): void {
  escribir(CLAVE_DATOS, { nombre: d.nombre, whatsapp: d.whatsapp, ciudad: d.ciudad });
}

export function olvidarDatosCliente(): void {
  try {
    localStorage.removeItem(CLAVE_DATOS);
  } catch {
    // Igual que al escribir: si no se puede, no hay nada que olvidar.
  }
}

export function leerPedidosGuardados(): PedidoGuardado[] {
  const lista = leer(CLAVE_PEDIDOS);
  return Array.isArray(lista) ? lista.filter(esPedidoGuardado) : [];
}

export function guardarPedidoEnCelular(p: PedidoGuardado): void {
  const otros = leerPedidosGuardados().filter((x) => x.id !== p.id);
  escribir(CLAVE_PEDIDOS, [p, ...otros].slice(0, MAX_PEDIDOS));
}

/** El pedido más reciente de las últimas `horas`, para avisar del adicional. */
export function pedidoReciente(horas = 12, ahora = Date.now()): PedidoGuardado | null {
  let reciente: PedidoGuardado | null = null;
  let fechaReciente = -Infinity;

  for (const p of leerPedidosGuardados()) {
    // Sin descartar fechas «futuras»: un reloj del celular atrasado las produce.
    const fecha = Date.parse(p.fecha);
    if (Number.isNaN(fecha) || ahora - fecha > horas * HORA || fecha <= fechaReciente) continue;
    reciente = p;
    fechaReciente = fecha;
  }
  return reciente;
}
