"use client";

import Image from "next/image";
import { useActionState } from "react";
import { iniciarSesion, type ResultadoLogin } from "./actions";
import { Boton } from "@/components/ui/Boton";

export default function PaginaLogin() {
  const [estado, accion, enviando] = useActionState<ResultadoLogin, FormData>(
    iniciarSesion,
    null
  );

  const campo =
    "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-3 " +
    "outline-none transition duration-200 focus:border-fucsia";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="flex justify-center pb-4">
        <Image
          src="/logo.jpg"
          alt="Anaya Beauty"
          width={120}
          height={120}
          className="rounded-full"
          priority
        />
      </div>

      <p className="pb-8 text-center text-sm text-carbon-suave">
        Panel de administración
      </p>

      <form action={accion} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Correo</span>
          <input
            name="correo"
            type="email"
            required
            autoComplete="email"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Contraseña</span>
          <input
            name="clave"
            type="password"
            required
            autoComplete="current-password"
            className={campo}
          />
        </label>

        {estado?.error && (
          <p
            role="alert"
            className="rounded-suave bg-fucsia/10 p-3 text-center text-sm text-fucsia"
          >
            {estado.error}
          </p>
        )}

        <Boton ancho type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
    </main>
  );
}
