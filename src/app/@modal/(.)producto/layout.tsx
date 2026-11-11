import type { ReactNode } from "react";
import { ModalProducto } from "@/components/producto/ModalProducto";

// La hoja vive aquí y no en la página: el esqueleto, la ficha y los saltos entre productos se turnan
// dentro de la misma hoja, sin que vuelva a subir desde abajo.
export default function LayoutVistaRapida({ children }: { children: ReactNode }) {
  return <ModalProducto>{children}</ModalProducto>;
}
