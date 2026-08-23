import { TarjetaProducto } from "./TarjetaProducto";
import type { Producto } from "@/lib/types";

export function GrillaProductos({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-xl text-carbon">
          No encontramos nada con esa búsqueda
        </p>
        <p className="pt-2 text-sm text-carbon-suave">
          Prueba con otro nombre o con la referencia del producto.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {productos.map((p) => (
        <TarjetaProducto key={p.id} producto={p} />
      ))}
    </div>
  );
}
