"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Boton, estilosBoton } from "@/components/ui/Boton";
import { Giro } from "@/components/ui/Giro";
import { MensajeError } from "@/components/admin/CamposPanel";
import { comprimirImagen } from "@/lib/imagen-navegador";
import { subirImagen } from "./actions";

type Estado = "libre" | "preparando" | "subiendo";

const TEXTO_ESTADO: Record<Exclude<Estado, "libre">, string> = {
  preparando: "Preparando la foto…",
  subiendo: "Subiendo la foto…",
};

/**
 * Foto del producto: se reduce en el navegador (las del celular pesan varios MB) y se sube al elegirla.
 * La que reemplaza se borra al guardar el producto; una subida sin guardar se descarta al subir otra.
 */
export function CampoImagen({
  valor,
  inicial,
  alCambiar,
  alOcupar,
  error,
}: {
  valor: string;
  inicial: string;
  alCambiar: (url: string) => void;
  alOcupar: (ocupado: boolean) => void;
  error?: string | null;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("libre");
  const [problema, setProblema] = useState<string | null>(null);
  const mensaje = problema ?? error ?? null;

  async function subir(archivo: File) {
    setProblema(null);
    alOcupar(true);
    try {
      setEstado("preparando");
      const foto = await comprimirImagen(archivo);

      setEstado("subiendo");
      const datos = new FormData();
      datos.set("archivo", new File([foto], "foto.jpg", { type: "image/jpeg" }));
      if (valor && valor !== inicial) datos.set("descartar", valor);

      const resultado = await subirImagen(datos).catch(() => null);
      if (!resultado) setProblema("No se pudo enviar la foto. Revisa tu conexión e intenta otra vez.");
      else if (resultado.ok) alCambiar(resultado.url);
      else setProblema(resultado.error);
    } catch (e) {
      setProblema(e instanceof Error ? e.message : "No pudimos leer esa foto. Prueba con otra en JPG o PNG.");
    } finally {
      setEstado("libre");
      alOcupar(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div>
      <p id="foto-titulo" className="text-[15px] font-semibold leading-5 text-tinta">
        Foto
      </p>
      <p id="foto-ayuda" className="mt-1 text-[13px] leading-[18px] text-tinta-suave">
        Puede ser la del celular: la reducimos antes de subirla. Es la que sirve de guía para elegir el tono.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="relative size-32 shrink-0 bg-superficie">
          {valor ? (
            <Image src={valor} alt="Foto actual del producto" fill sizes="128px" className="object-contain p-2 mix-blend-multiply" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-tinta-suave">Sin foto</span>
          )}
          {estado !== "libre" && (
            <span className="absolute inset-0 flex items-center justify-center bg-superficie text-tinta">
              <Giro className="size-6" />
            </span>
          )}
        </div>

        <div className="flex flex-col items-start gap-2">
          <input
            ref={entrada}
            id="foto-archivo"
            type="file"
            accept="image/*"
            disabled={estado !== "libre"}
            aria-describedby={["foto-ayuda", mensaje ? "foto-error" : ""].filter(Boolean).join(" ")}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor="foto-archivo"
            className={estilosBoton({
              variante: "contorno",
              tamano: "compacto",
              className:
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acento " +
                "peer-disabled:cursor-wait peer-disabled:bg-inactivo peer-disabled:text-tinta-suave",
            })}
          >
            {valor ? "Cambiar foto" : "Subir foto"}
          </label>
          {valor && estado === "libre" && (
            <Boton type="button" variante="fantasma" tamano="compacto" onClick={() => alCambiar("")}>
              Quitar foto
            </Boton>
          )}
        </div>
      </div>

      <p role="status" className="mt-2 min-h-5 text-sm leading-5 text-tinta-suave">
        {estado === "libre" ? "" : TEXTO_ESTADO[estado]}
      </p>
      {mensaje && (
        <div role="alert">
          <MensajeError id="foto-error">{mensaje}</MensajeError>
        </div>
      )}
    </div>
  );
}
