import type { Escalon } from "@/lib/pricing";

export type Categoria = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  categoriaPadreId: string | null;
};

export type Tono = {
  id: string;
  nombre: string;
  colorHex: string;
  orden: number;
};

export type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  imagenPrincipal: string | null;
  galeria: string[];
  stock: number;
  activo: boolean;
  escalones: Escalon[];
  tonos: Tono[];
};

/**
 * Lo que se guarda en el navegador. Nunca incluye precios.
 * La identidad de una línea es producto + tono: dos tonos del mismo
 * producto son dos líneas separadas.
 */
export type LineaCarrito = {
  productoId: string;
  tonoId: string | null;
  tonoNombre: string | null;
  cantidad: number;
};

export type EstadoPedido = "nuevo" | "pagado" | "enviado" | "cancelado";

export type LineaPedido = {
  id: string;
  referencia: string;
  nombre: string;
  tono: string | null;
  cantidad: number;
  precioUnitarioAplicado: number;
  subtotal: number;
};

export type Pedido = {
  id: string;
  numeroPedido: string;
  clienteNombre: string;
  clienteWhatsapp: string;
  clienteCiudad: string;
  subtotal: number;
  descuento: number;
  porcentajeDescuento: number;
  porMayor: boolean;
  total: number;
  estado: EstadoPedido;
  notasAdmin: string | null;
  codigoUsado: string | null;
  creadoEn: string;
  lineas: LineaPedido[];
};

export type EstadoCodigo = "disponible" | "usado" | "anulado";

export type Codigo = {
  id: string;
  code: string;
  estado: EstadoCodigo;
  venceEn: string;
  creadoEn: string;
  usadoEn: string | null;
  numeroPedido: string | null;
  nota: string | null;
};
