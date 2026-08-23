"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarCodigoNuevo, anularCodigo } from "./actions";
import { Boton } from "@/components/ui/Boton";
import { IconoWhatsApp, IconoCheck } from "@/components/ui/Iconos";
import type { Codigo } from "@/lib/types";

export function PanelCodigos({
  codigos,
  sitio,
}: {
  codigos: Codigo[];
  sitio: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [reciente, setReciente] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enlace = reciente ? `${sitio}/c/${reciente}` : "";

  const mensaje = reciente
    ? `¡Hola, preciosa! 💕 Ya confirmamos tu pago ✨\n\n` +
      `Tu código es: ${reciente}\n\n` +
      `Toca aquí y tu código se aplica solo:\n${enlace}\n\n` +
      `Ahí eliges todo lo que quieras y confirmas tu pedido.\n` +
      `¡Gracias por confiar en Anaya Beauty! ♡`
    : "";

  function copiar() {
    navigator.clipboard.writeText(mensaje).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      },
      () => setError("No se pudo copiar. Selecciona el texto a mano.")
    );
  }

  return (
    <div className="space-y-6">
      <Boton
        disabled={pendiente}
        onClick={() =>
          iniciarTransicion(async () => {
            setError(null);
            try {
              const { code } = await generarCodigoNuevo();
              setReciente(code);
              setCopiado(false);
              router.refresh();
            } catch {
              setError("No se pudo generar el código. Vuelve a intentarlo.");
            }
          })
        }
      >
        {pendiente ? "Generando…" : "Generar código nuevo"}
      </Boton>

      {error && (
        <p role="alert" className="rounded-suave bg-fucsia/10 p-3 text-sm text-fucsia">
          {error}
        </p>
      )}

      {reciente && (
        <div className="space-y-4 rounded-tarjeta bg-petalo p-6 shadow-flotante">
          <p className="text-center font-display text-6xl tracking-[0.3em] text-fucsia">
            {reciente}
          </p>

          <pre className="whitespace-pre-wrap rounded-suave bg-rosa-nube p-4 text-xs leading-relaxed text-carbon">
            {mensaje}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={copiar}>
              {copiado ? (
                <>
                  <IconoCheck className="h-4 w-4" /> ¡Copiado!
                </>
              ) : (
                "Copiar mensaje"
              )}
            </Boton>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Boton>
                <IconoWhatsApp /> Abrir WhatsApp
              </Boton>
            </a>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {codigos.map((c) => {
          const vencido = c.estado === "disponible" && new Date(c.venceEn) < new Date();

          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-suave bg-petalo px-4 py-3 shadow-petalo"
            >
              <span
                className={`font-display text-2xl tracking-widest ${
                  c.estado === "disponible" && !vencido ? "text-fucsia" : "text-carbon-suave"
                }`}
              >
                {c.code}
              </span>

              <div className="min-w-0 flex-1 text-xs text-carbon-suave">
                {c.estado === "usado" ? (
                  <p>Usado en {c.numeroPedido ?? "un pedido"}</p>
                ) : c.estado === "anulado" ? (
                  <p>Anulado</p>
                ) : vencido ? (
                  <p>Vencido</p>
                ) : (
                  <p>
                    Vence{" "}
                    {new Date(c.venceEn).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>

              {c.estado === "disponible" && !vencido && (
                <button
                  onClick={() =>
                    iniciarTransicion(async () => {
                      await anularCodigo(c.id);
                      router.refresh();
                    })
                  }
                  className="min-h-[40px] cursor-pointer px-2 text-xs text-carbon-suave
                             underline transition hover:text-fucsia"
                >
                  Anular
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
