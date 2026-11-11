import type { Escalon } from "@/lib/pricing";
import type { ReglaDescuento } from "@/lib/discounts";

export type EtiquetaVariante = "Tono" | "Color" | "Diseño" | "Modelo" | "Aroma" | "Largo" | "Paleta";

export type Categoria = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  categoriaPadreId: string | null;
  etiquetaVariante: EtiquetaVariante | null;
};

export type Variante = {
  id: string;
  nombre: string;
  colorHex: string;
  orden: number;
  agotado: boolean;
};

export type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaSlug: string | null;
  imagenPrincipal: string | null;
  galeria: string[];
  stock: number;
  activo: boolean;
  destacado: boolean;
  escalones: Escalon[];
  etiquetaVariante: EtiquetaVariante;
  numVariantes: number;
  /** null = no se cargaron (grilla); la ficha las trae en el orden de la foto. */
  variantes: Variante[] | null;
};

/**
 * Lo que se guarda en el navegador (versión 3 del almacenamiento): nunca
 * precios. La identidad de una línea es producto + variante.
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
  notasCliente: string | null;
  subtotal: number;
  descuento: number;
  porcentajeDescuento: number;
  porMayor: boolean;
  total: number;
  estado: EstadoPedido;
  notasAdmin: string | null;
  creadoEn: string;
  lineas: LineaPedido[];
};

export type OrdenCatalogo = "destacados" | "precio-asc" | "precio-desc" | "nuevos";

export type PaginaProductos = {
  productos: Producto[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type SugerenciaProducto = {
  referencia: string;
  nombre: string;
  imagenPrincipal: string | null;
  precioBase: number | null;
  numVariantes: number;
  etiquetaVariante: EtiquetaVariante;
};

export type ProductoBolsa = {
  id: string;
  referencia: string;
  nombre: string;
  imagenPrincipal: string | null;
  stock: number;
  activo: boolean;
  escalones: Escalon[];
  etiquetaVariante: EtiquetaVariante;
  variantes: Variante[];
};

export type DatosBolsa = {
  productos: ProductoBolsa[];
  reglas: ReglaDescuento[];
  umbralPorMayor: number;
};

export type ConfiguracionPublica = {
  mensajeExito: string | null;
  umbralPorMayor: number;
  whatsappNegocio: string;
  envioInfo: string;
  pago: { metodo: string | null; numero: string | null; titular: string | null };
};
