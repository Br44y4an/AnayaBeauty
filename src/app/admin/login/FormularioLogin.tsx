"use client";

import { useActionState } from "react";
import { iniciarSesion, type ResultadoLogin } from "./actions";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { IconoAlerta } from "@/components/ui/Iconos";

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState<ResultadoLogin, FormData>(iniciarSesion, null);
  const idError = estado?.error ? "login-error" : undefined;

  return (
    <form action={accion} className="space-y-5">
      <Campo
        id="login-correo"
        name="correo"
        type="email"
        etiqueta="Correo"
        required
        autoComplete="email"
        inputMode="email"
        defaultValue={estado?.correo ?? ""}
        aria-describedby={idError}
      />
      <Campo
        id="login-clave"
        name="clave"
        type="password"
        etiqueta="Contraseña"
        required
        autoComplete="current-password"
        aria-describedby={idError}
      />

      {estado?.error && (
        <p
          id={idError}
          role="alert"
          className="flex items-start gap-2 rounded-md bg-error-fondo px-4 py-3 text-[15px] leading-6 text-error"
        >
          <IconoAlerta tamano={20} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      <Boton type="submit" ancho cargando={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
