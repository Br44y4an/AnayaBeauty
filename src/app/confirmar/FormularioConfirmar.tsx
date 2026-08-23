"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usarCarrito } from "@/lib/cart";
import { confirmarPedido, type ResultadoConfirmacion } from "./actions";
import { Boton } from "@/components/ui/Boton";
import { enlaceWhatsApp } from "@/lib/format";
import { IconoWhatsApp } from "@/components/ui/Iconos";

const CAMPO =
  "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-3 " +
  "text-carbon outline-none transition duration-200 focus:border-fucsia " +
  "placeholder:text-carbon-suave/50";

export function FormularioConfirmar() {
  const router = useRouter();
  const parametros = useSearchParams();
  const { lineas, codigo, guardarCodigo, vaciar } = usarCarrito();

  const [estado, accion, enviando] = useActionState<ResultadoConfirmacion | null, FormData>(
    confirmarPedido,
    null
  );

  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // El link mágico trae el código en la dirección: se guarda para que
  // sobreviva aunque la clienta navegue a otra pantalla.
  const codigoDeLaUrl = parametros.get("codigo");
  useEffect(() => {
    if (codigoDeLaUrl && codigoDeLaUrl.length === 4) guardarCodigo(codigoDeLaUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoDeLaUrl]);

  // Al confirmar se vacía la bolsa y se pasa a la pantalla de éxito.
  useEffect(() => {
    if (estado?.ok) {
      vaciar();
      router.push(`/pedido/${estado.pedidoId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (!montado) {
    return <p className="py-10 text-center text-carbon-suave">Cargando…</p>;
  }

  if (lineas.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="font-display text-xl text-carbon">Tu bolsa está vacía</p>
        <p className="text-sm text-carbon-suave">
          Vuelve al catálogo para armar tu pedido ♡
        </p>
        <Link href="/" className="inline-block">
          <Boton>Ver el catálogo</Boton>
        </Link>
      </div>
    );
  }

  const itemsSerializados = JSON.stringify(
    lineas.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad }))
  );

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="items" value={itemsSerializados} />

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">
          Tu código de 4 dígitos
        </span>
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          required
          defaultValue={codigo ?? codigoDeLaUrl ?? ""}
          placeholder="0000"
          className={`${CAMPO} text-center font-display text-3xl tracking-[0.5em]`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">
          Tu nombre completo
        </span>
        <input name="nombre" required maxLength={80} autoComplete="name" className={CAMPO} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">Tu WhatsApp</span>
        <input
          name="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={20}
          placeholder="300 123 4567"
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">Tu ciudad</span>
        <input
          name="ciudad"
          required
          maxLength={60}
          autoComplete="address-level2"
          placeholder="Medellín"
          className={CAMPO}
        />
      </label>

      {estado && !estado.ok && (
        <div role="alert" className="space-y-2 rounded-tarjeta bg-fucsia/10 p-4 text-center">
          <p className="text-sm font-semibold text-fucsia">{estado.mensaje}</p>
          <a
            href={enlaceWhatsApp("Hola, tuve un problema al confirmar mi pedido")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-carbon-suave underline"
          >
            <IconoWhatsApp className="h-4 w-4" />
            Escribirnos por WhatsApp
          </a>
        </div>
      )}

      <Boton ancho type="submit" disabled={enviando}>
        {enviando ? "Confirmando tu pedido…" : "Confirmar mi pedido 💕"}
      </Boton>

      <p className="text-center text-xs text-carbon-suave">
        Al confirmar apartamos tus productos a tu nombre.
      </p>
    </form>
  );
}
