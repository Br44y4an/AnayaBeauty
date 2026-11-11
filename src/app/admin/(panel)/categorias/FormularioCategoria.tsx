"use client";

import { useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { CampoLista } from "@/components/admin/CamposPanel";
import { madresPosibles } from "@/lib/admin/categorias";
import type { Resultado } from "@/lib/admin/resultado";
import type { CategoriaPanel } from "@/lib/data/admin-catalog";
import { generarSlug } from "@/lib/slug";
import { ETIQUETAS_VARIANTE, resolverEtiqueta } from "@/lib/variantes";
import { guardarCategoria } from "./actions";

const SIN_CONEXION = "No se pudo conectar para guardar. Revisa tu internet e intenta otra vez.";

/** Crear (`categoria` null) o editar. El slug se fija al crear y no cambia al renombrar. */
export function FormularioCategoria({
  categoria,
  categorias,
  alGuardar,
  alCancelar,
}: {
  categoria: CategoriaPanel | null;
  categorias: CategoriaPanel[];
  alGuardar: (nombre: string) => void;
  alCancelar: () => void;
}) {
  const prefijo = categoria ? `categoria-${categoria.id}` : "categoria-nueva";
  const [pendiente, iniciar] = useTransition();
  const [fallo, setFallo] = useState<Extract<Resultado, { ok: false }> | null>(null);
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [madreId, setMadreId] = useState(categoria?.categoriaPadreId ?? "");

  const madres = madresPosibles(categorias, categoria?.id ?? null);
  const madre = categorias.find((c) => c.id === madreId) ?? null;
  const heredada = resolverEtiqueta({
    producto: null,
    categoria: null,
    departamento: madre?.etiquetaVariante ?? null,
    slugDepartamento: madre?.slug ?? categoria?.slug ?? (generarSlug(nombre) || null),
  });
  const tieneHijas = categoria !== null && madres.length === 0;
  const errores = fallo?.campos ?? {};

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    iniciar(async () => {
      const resultado = await guardarCategoria(datos).catch(() => null);
      if (resultado?.ok) {
        setFallo(null);
        alGuardar(resultado.nombre);
        return;
      }
      flushSync(() => setFallo(resultado ?? { ok: false, error: SIN_CONEXION }));
      formulario.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <input type="hidden" name="id" value={categoria?.id ?? ""} />
      <Campo
        id={`${prefijo}-nombre`}
        name="nombre"
        etiqueta="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        ayuda={categoria ? `Su dirección sigue siendo /?categoria=${categoria.slug} aunque cambies el nombre.` : undefined}
        error={errores.nombre}
        autoComplete="off"
        maxLength={60}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoLista
          id={`${prefijo}-madre`}
          name="categoria_padre_id"
          etiqueta="Dentro de"
          ayuda={tieneHijas ? "Tiene subcategorías, así que es un departamento." : undefined}
          value={madreId}
          onChange={(e) => setMadreId(e.target.value)}
          disabled={tieneHijas}
          error={errores.categoria_padre_id}
        >
          <option value="">Ninguna: es un departamento</option>
          {madres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
              {m.activo ? "" : " (oculta)"}
            </option>
          ))}
        </CampoLista>
        <CampoLista
          id={`${prefijo}-etiqueta`}
          name="etiqueta_variante"
          etiqueta="Las variantes se llaman"
          defaultValue={categoria?.etiquetaVariante ?? ""}
          error={errores.etiqueta_variante}
        >
          <option value="">
            {madre ? "Según el departamento" : "Por defecto"} ({heredada.toLowerCase()})
          </option>
          {ETIQUETAS_VARIANTE.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </CampoLista>
      </div>

      {fallo && <AvisoPanel tono="error">{fallo.error}</AvisoPanel>}
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" tamano="compacto" cargando={pendiente}>
          {pendiente ? "Guardando…" : categoria ? "Guardar" : "Agregar categoría"}
        </Boton>
        <Boton type="button" variante="fantasma" tamano="compacto" disabled={pendiente} onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
