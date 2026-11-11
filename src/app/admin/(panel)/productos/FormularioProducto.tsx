"use client";

import { useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisoPanel } from "@/components/admin/AvisoPanel";
import { CampoArea, CampoLista, Interruptor } from "@/components/admin/CamposPanel";
import { arbolDeCategorias, departamentoDe } from "@/lib/categorias";
import { ETIQUETAS_VARIANTE, resolverEtiqueta } from "@/lib/variantes";
import { urlListaProductos, type EstadoLista } from "@/lib/admin/filtros";
import type { CategoriaPanel, ProductoPanel } from "@/lib/data/admin-catalog";
import type { Resultado } from "@/lib/admin/resultado";
import type { EtiquetaVariante } from "@/lib/types";
import { guardarProducto } from "./actions";
import { CampoImagen } from "./CampoImagen";
import { EditorEscalones } from "./EditorEscalones";
import { EditorVariantes } from "./EditorVariantes";

const SECCION = "space-y-5 border-t border-linea pt-6";
const SIN_CONEXION = "No se pudo conectar para guardar. Revisa tu internet e intenta otra vez.";

function etiquetaHeredada(categoriaId: string, categorias: CategoriaPanel[]): EtiquetaVariante {
  const departamento = departamentoDe(categoriaId || null, categorias);
  return resolverEtiqueta({
    producto: null,
    categoria: categorias.find((c) => c.id === categoriaId)?.etiquetaVariante ?? null,
    departamento: departamento?.etiquetaVariante ?? null,
    slugDepartamento: departamento?.slug ?? null,
  });
}

/** Los productos van en las categorías hijas; el departamento solo aparece si el producto ya está en él. */
function OpcionesCategoria({ categorias, actual }: { categorias: CategoriaPanel[]; actual: string | null }) {
  const oculta = new Set(categorias.filter((c) => !c.activo).map((c) => c.id));
  const texto = (c: { id: string; nombre: string }) => (oculta.has(c.id) ? `${c.nombre} (oculta)` : c.nombre);

  return (
    <>
      <option value="">Sin categoría</option>
      {arbolDeCategorias(categorias).map((d) =>
        d.hijas.length === 0 ? (
          <option key={d.id} value={d.id}>
            {texto(d)}
          </option>
        ) : (
          <optgroup key={d.id} label={d.nombre}>
            {d.id === actual && <option value={d.id}>{texto(d)}</option>}
            {d.hijas.map((h) => (
              <option key={h.id} value={h.id}>
                {texto(h)}
              </option>
            ))}
          </optgroup>
        )
      )}
    </>
  );
}

/** Valida todo en el servidor antes de escribir; si falla, cada error aparece junto a su campo. */
export function FormularioProducto({
  producto,
  categorias,
  lista,
}: {
  producto: ProductoPanel | null;
  categorias: CategoriaPanel[];
  lista: EstadoLista;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [fallo, setFallo] = useState<Extract<Resultado, { ok: false }> | null>(null);
  const [imagen, setImagen] = useState(producto?.imagenPrincipal ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? "");
  const [etiqueta, setEtiqueta] = useState<string>(producto?.etiquetaPropia ?? "");

  const heredada = etiquetaHeredada(categoriaId, categorias);
  const efectiva = ETIQUETAS_VARIANTE.find((e) => e === etiqueta) ?? heredada;
  const errores = fallo?.campos ?? {};

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    iniciar(async () => {
      const resultado = await guardarProducto(datos).catch(() => null);
      if (resultado?.ok) {
        router.push(urlListaProductos(lista, { guardado: resultado.id }));
        return;
      }
      flushSync(() => setFallo(resultado ?? { ok: false, error: SIN_CONEXION }));
      formulario.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido] input:not([type="hidden"])')?.focus();
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <input type="hidden" name="id" value={producto?.id ?? ""} />
      <input type="hidden" name="imagen_principal" value={imagen} />
      <input type="hidden" name="etiqueta_efectiva" value={efectiva} />

      <section aria-labelledby="datos-titulo" className="space-y-5">
        <h2 id="datos-titulo" className="sr-only">
          Datos del producto
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="referencia"
            name="referencia"
            etiqueta="Referencia"
            defaultValue={producto?.referencia}
            ayuda="Como aparece en la etiqueta, por ejemplo GLS735."
            error={errores.referencia}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
          <Campo
            id="stock"
            name="stock"
            etiqueta="Unidades en stock"
            defaultValue={producto?.stock ?? 0}
            inputMode="numeric"
            error={errores.stock}
            required
          />
        </div>
        <Campo id="nombre" name="nombre" etiqueta="Nombre" defaultValue={producto?.nombre} error={errores.nombre} required />
        <CampoArea
          id="descripcion"
          name="descripcion"
          etiqueta="Descripción (opcional)"
          ayuda="Solo si agrega algo al nombre: tamaño, acabado o cómo se usa."
          defaultValue={producto?.descripcion ?? ""}
          error={errores.descripcion}
          rows={3}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoLista
            id="category_id"
            name="category_id"
            etiqueta="Categoría"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            error={errores.category_id}
          >
            <OpcionesCategoria categorias={categorias} actual={producto?.categoriaId ?? null} />
          </CampoLista>
          <CampoLista
            id="etiqueta_variante"
            name="etiqueta_variante"
            etiqueta="Las variantes se llaman"
            ayuda="Así lo dice la tienda: «Elige el tono», «6 colores»."
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            error={errores.etiqueta_variante}
          >
            <option value="">Según la categoría ({heredada.toLowerCase()})</option>
            {ETIQUETAS_VARIANTE.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </CampoLista>
        </div>
      </section>

      <section aria-label="Foto" className={SECCION}>
        <CampoImagen
          valor={imagen}
          inicial={producto?.imagenPrincipal ?? ""}
          alCambiar={setImagen}
          alOcupar={setSubiendo}
          error={errores.imagen_principal}
        />
      </section>

      <section className={SECCION}>
        <EditorEscalones iniciales={producto?.escalones ?? []} error={errores.escalones} />
      </section>

      <section className={SECCION}>
        <EditorVariantes iniciales={producto?.variantes ?? []} etiqueta={efectiva} error={errores.variantes} />
      </section>

      <section aria-label="En la tienda" className={`${SECCION} space-y-1`}>
        <Interruptor
          id="activo"
          name="activo"
          etiqueta="Visible en la tienda"
          ayuda="Apágalo para sacarlo de la tienda sin borrarlo."
          defaultChecked={producto?.activo ?? true}
        />
        <Interruptor
          id="destacado"
          name="destacado"
          etiqueta="Destacado"
          ayuda="Sale en «Destacados», al inicio de la tienda, mientras tenga stock."
          defaultChecked={producto?.destacado ?? false}
        />
      </section>

      <div className="space-y-4 border-t border-linea pt-6">
        {fallo && <AvisoPanel tono="error">{fallo.error}</AvisoPanel>}
        {subiendo && <p className="text-sm text-tinta-suave">Espera a que termine de subir la foto para guardar.</p>}
        <div className="flex flex-wrap gap-3">
          <Boton type="submit" cargando={pendiente} disabled={subiendo}>
            {pendiente ? "Guardando…" : producto ? "Guardar cambios" : "Crear producto"}
          </Boton>
          <BotonEnlace href={urlListaProductos(lista)} variante="fantasma">
            Cancelar
          </BotonEnlace>
        </div>
      </div>
    </form>
  );
}
