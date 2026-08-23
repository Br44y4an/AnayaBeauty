import type { Escalon } from "@/lib/pricing";

export type Categoria = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  categoriaPadreId: string | null;
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
};

/** Lo que se guarda en el navegador. Nunca incluye precios. */
export type LineaCarrito = {
  productoId: string;
  cantidad: number;
};

export type EstadoPedido = "nuevo" | "pagado" | "enviado" | "cancelado";

export type LineaPedido = {
  id: string;
  referencia: string;
  nombre: string;
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
