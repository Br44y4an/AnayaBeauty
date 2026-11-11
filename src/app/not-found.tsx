import type { Metadata } from "next";
import { BotonEnlace } from "@/components/ui/Boton";
import { Marca } from "@/components/ui/Marca";

export const metadata: Metadata = { title: "No encontramos esta página" };

/** 404 de cualquier dirección que no existe (el de la ficha dice que el producto ya no está disponible). */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Marca />
      <h1 className="mt-8 text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-tinta">
        No encontramos esta página
      </h1>
      <p className="mt-2 text-base text-tinta-suave">
        El enlace puede estar incompleto o el producto ya no está en el catálogo.
      </p>
      <BotonEnlace href="/" ancho className="mt-8">
        Ver el catálogo
      </BotonEnlace>
    </main>
  );
}
