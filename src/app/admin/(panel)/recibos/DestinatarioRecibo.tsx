"use client";

import { useRef } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { LARGO, type Destinatario } from "@/lib/admin/recibo";
import { SeccionRecibo } from "./SeccionRecibo";

const CAMPOS: {
  campo: keyof Destinatario;
  etiqueta: string;
  ancho?: boolean;
  props?: { inputMode?: "tel"; autoComplete?: string };
}[] = [
  { campo: "nombre", etiqueta: "Nombre o razón social", ancho: true },
  { campo: "documento", etiqueta: "Documento o NIT (opcional)" },
  { campo: "whatsapp", etiqueta: "WhatsApp (opcional)", props: { inputMode: "tel" } },
  { campo: "ciudad", etiqueta: "Ciudad (opcional)" },
  { campo: "direccion", etiqueta: "Dirección (opcional)" },
];

/** «Dirigido a»: desde un pedido llega lleno y se puede cambiar; «Volver a los datos del pedido» lo deshace. */
export function DestinatarioRecibo({
  destinatario,
  desdePedido,
  editado,
  alCambiar,
  alRestaurar,
}: {
  destinatario: Destinatario;
  desdePedido: boolean;
  editado: boolean;
  alCambiar: (campo: keyof Destinatario, valor: string) => void;
  alRestaurar: () => void;
}) {
  const nombre = useRef<HTMLInputElement>(null);

  return (
    <SeccionRecibo
      id="recibo-destinatario"
      titulo="Dirigido a"
      ayuda={
        desdePedido
          ? "Sale de los datos del pedido. Cámbialo si el recibo va a nombre de otra persona o de una empresa."
          : "A nombre de quién sale el recibo."
      }
      accion={
        editado && (
          <Boton
            type="button"
            variante="contorno"
            tamano="compacto"
            onClick={() => {
              alRestaurar();
              nombre.current?.focus();
            }}
          >
            Volver a los datos del pedido
          </Boton>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(({ campo, etiqueta, ancho, props }) => (
          <Campo
            key={campo}
            id={`recibo-${campo}`}
            ref={campo === "nombre" ? nombre : undefined}
            etiqueta={etiqueta}
            className={ancho ? "sm:col-span-2" : ""}
            value={destinatario[campo]}
            onChange={(e) => alCambiar(campo, e.target.value)}
            maxLength={LARGO[campo]}
            autoComplete="off"
            required={campo === "nombre"}
            {...props}
          />
        ))}
      </div>
    </SeccionRecibo>
  );
}
