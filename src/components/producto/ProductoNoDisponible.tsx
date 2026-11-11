"use client";

import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { useModalProducto } from "@/components/producto/ModalProducto";

/** Producto inexistente u oculto. En la vista rápida no se usa notFound(): se dice aquí y se cierra. */
export function ProductoNoDisponible() {
  const modal = useModalProducto();
  const Titulo = modal ? "h2" : "h1";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-2 py-16 text-center md:py-20">
      <Titulo className="text-2xl font-semibold leading-[30px] text-tinta">Este producto ya no está disponible</Titulo>
      <p className="mt-2 text-base leading-6 text-tinta-suave">
        Puede que se haya agotado o que ya no esté en el catálogo.
      </p>
      {modal ? (
        <Boton variante="secundario" onClick={modal.cerrar} className="mt-6 min-w-48">
          Cerrar
        </Boton>
      ) : (
        <BotonEnlace href="/" className="mt-6 min-w-48">
          Ver el catálogo
        </BotonEnlace>
      )}
    </div>
  );
}
