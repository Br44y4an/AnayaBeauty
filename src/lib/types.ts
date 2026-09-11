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
  /**
   * Cuántos tonos tiene el producto.
   *
   * La grilla del catálogo ya NO trae los tonos: con 591 productos y
   * paletas de 30 colores eran ~12.000 filas extra por pantalla, y la
   * clienta veía un muro de círculos de productos que ni le interesaban.
   * Aquí solo viaja el número (para saber si hay que ofrecer la hoja de
   * tonos) y los tonos se piden al abrirla.
   */
  numTonos: number;
  /** Vacío en la grilla; completo en el detalle y en la hoja de tonos. */
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
  /** Indicaciones que la clienta escribió al confirmar (opcional). */
  notasCliente: string | null;
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
