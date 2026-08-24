"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarProducto, subirImagen, type ResultadoGuardado } from "./actions";
import { subtotalPara, type Escalon } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { IconoMas, IconoCorazon } from "@/components/ui/Iconos";
import type { Producto, Categoria } from "@/lib/types";

const CAMPO =
  "min-h-[44px] w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-2.5 " +
  "outline-none transition duration-200 focus:border-fucsia";

type FilaEscalon = { minCantidad: number; precioUnitario: number };
type FilaTono = { nombre: string; colorHex: string };

export function FormularioProducto({
  producto,
  categorias,
}: {
  producto?: Producto;
  categorias: Categoria[];
}) {
  const router = useRouter();

  const [estado, accion, enviando] = useActionState<ResultadoGuardado | null, FormData>(
    guardarProducto,
    null
  );

  const [imagen, setImagen] = useState(producto?.imagenPrincipal ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  const [tonos, setTonos] = useState<FilaTono[]>(
    producto?.tonos.map((t) => ({ nombre: t.nombre, colorHex: t.colorHex })) ?? []
  );

  const [escalones, setEscalones] = useState<FilaEscalon[]>(
    producto?.escalones.length
      ? producto.escalones.map((e) => ({
          minCantidad: e.minCantidad,
          precioUnitario: e.precioUnitario,
        }))
      : [{ minCantidad: 1, precioUnitario: NaN }]
  );

  if (estado?.ok) {
    router.push("/admin/productos");
  }

  async function alSubirImagen(archivo: File) {
    setSubiendo(true);
    setErrorImagen(null);
    try {
      const datos = new FormData();
      datos.set("archivo", archivo);
      setImagen(await subirImagen(datos));
    } catch (e) {
      setErrorImagen(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  }

  function actualizar(indice: number, campo: keyof FilaEscalon, texto: string) {
    const valor = texto === "" ? NaN : Number(texto);
    setEscalones((previo) =>
      previo.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e))
    );
  }

  // Vista previa con los mismos cálculos que verá la clienta
  const validos: Escalon[] = escalones.filter((e) => e.precioUnitario > 0);
  const ejemplos = [1, 3, 6, 12];

  return (
    <form action={accion} className="max-w-2xl space-y-5">
      {producto && <input type="hidden" name="id" value={producto.id} />}
      <input type="hidden" name="imagen_principal" value={imagen} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Referencia</span>
          <input
            name="referencia"
            required
            defaultValue={producto?.referencia}
            placeholder="REF-101"
            className={`${CAMPO} uppercase`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-carbon">Stock</span>
          <input
            name="stock"
            type="number"
            min={0}
            required
            defaultValue={producto?.stock ?? 0}
            className={CAMPO}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">Nombre</span>
        <input
          name="nombre"
          required
          defaultValue={producto?.nombre}
          placeholder="Labial Rojo Pasión"
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">
          Descripción <span className="font-normal text-carbon-suave">(opcional)</span>
        </span>
        <textarea
          name="descripcion"
          rows={2}
          defaultValue={producto?.descripcion ?? ""}
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-carbon">Categoría</span>
        <select
          name="category_id"
          defaultValue={producto?.categoriaId ?? ""}
          className={CAMPO}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      {/* Imagen */}
      <div>
        <span className="mb-1 block text-sm font-semibold text-carbon">Imagen</span>

        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
            {imagen ? (
              <Image src={imagen} alt="Vista previa" fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-lila-suave">
                <IconoCorazon className="h-7 w-7" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              disabled={subiendo}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) alSubirImagen(archivo);
              }}
              className="w-full text-sm text-carbon-suave file:mr-3 file:cursor-pointer
                         file:rounded-pastilla file:border-0 file:bg-lila-suave/50
                         file:px-4 file:py-2 file:text-sm file:font-semibold file:text-lila"
            />
            {subiendo && <p className="pt-1 text-xs text-lila">Subiendo…</p>}
            {errorImagen && <p className="pt-1 text-xs text-fucsia">{errorImagen}</p>}
          </div>
        </div>
      </div>

      {/* Escalones de precio */}
      <fieldset className="space-y-3 rounded-tarjeta bg-petalo p-4 shadow-petalo">
        <legend className="px-1 text-sm font-semibold text-carbon">
          Precios por cantidad
        </legend>

        <p className="text-xs text-carbon-suave">
          El primer escalón siempre es 1 unidad. Agrega más para premiar a quien lleve
          varias: por ejemplo, desde 3 a $9.000 y desde 6 a $8.000.
        </p>

        {escalones.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-carbon-suave">desde</span>

            <input
              name="min_cantidad"
              type="number"
              min={1}
              value={Number.isNaN(e.minCantidad) ? "" : e.minCantidad}
              readOnly={i === 0}
              onChange={(ev) => actualizar(i, "minCantidad", ev.target.value)}
              className={`w-20 rounded-suave border-2 border-lila-suave px-3 py-2
                          outline-none focus:border-fucsia ${i === 0 ? "bg-rosa-nube" : "bg-petalo"}`}
            />

            <span className="text-sm text-carbon-suave">unds →</span>

            <input
              name="precio_unitario"
              type="number"
              min={1}
              step={1}
              value={Number.isNaN(e.precioUnitario) ? "" : e.precioUnitario}
              onChange={(ev) => actualizar(i, "precioUnitario", ev.target.value)}
              className="w-32 rounded-suave border-2 border-lila-suave bg-petalo px-3 py-2
                         outline-none focus:border-fucsia"
            />

            <span className="text-sm text-carbon-suave">c/u</span>

            {i > 0 && (
              <button
                type="button"
                onClick={() => setEscalones((p) => p.filter((_, j) => j !== i))}
                className="min-h-[40px] cursor-pointer px-2 text-xs text-carbon-suave
                           underline transition hover:text-fucsia"
              >
                quitar
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setEscalones((p) => [
              ...p,
              {
                minCantidad: Math.max(...p.map((e) => e.minCantidad || 0)) + 2,
                precioUnitario: NaN,
              },
            ])
          }
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-1
                     rounded-pastilla border-2 border-fucsia-suave px-4 text-sm
                     font-semibold text-fucsia transition hover:border-fucsia"
        >
          <IconoMas className="h-4 w-4" /> Agregar escalón
        </button>

        {validos.length > 0 && (
          <div className="rounded-suave bg-rosa-nube p-3">
            <p className="pb-2 text-xs font-semibold text-carbon">
              Así lo verá la clienta:
            </p>
            <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
              {ejemplos.map((cantidad) => (
                <li key={cantidad} className="text-carbon-suave">
                  {cantidad} und{cantidad > 1 ? "s" : ""} ={" "}
                  <strong className="text-fucsia">
                    {pesos(subtotalPara(validos, cantidad))}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      {/* Tonos de color */}
      <fieldset className="space-y-3 rounded-tarjeta bg-petalo p-4 shadow-petalo">
        <legend className="px-1 text-sm font-semibold text-carbon">
          Tonos de color
        </legend>

        <p className="text-xs text-carbon-suave">
          Solo para productos que se venden en varios tonos, como labiales o
          sombras. Si agregas tonos, la clienta <strong>tendrá que elegir uno</strong>{" "}
          antes de poder comprar. Déjalo vacío para brochas, esponjas y demás.
        </p>

        {tonos.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              name="tono_color"
              value={t.colorHex}
              onChange={(ev) =>
                setTonos((p) =>
                  p.map((x, j) => (j === i ? { ...x, colorHex: ev.target.value } : x))
                )
              }
              aria-label={`Color del tono ${i + 1}`}
              className="h-11 w-14 cursor-pointer rounded-suave border-2 border-lila-suave bg-petalo"
            />

            <input
              name="tono_nombre"
              value={t.nombre}
              placeholder="Cereza"
              onChange={(ev) =>
                setTonos((p) =>
                  p.map((x, j) => (j === i ? { ...x, nombre: ev.target.value } : x))
                )
              }
              className="min-h-[44px] flex-1 rounded-suave border-2 border-lila-suave
                         bg-petalo px-4 outline-none focus:border-fucsia"
            />

            <span
              style={{ backgroundColor: t.colorHex }}
              className="h-9 w-9 shrink-0 rounded-full ring-1 ring-black/10"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={() => setTonos((p) => p.filter((_, j) => j !== i))}
              className="min-h-[40px] cursor-pointer px-2 text-xs text-carbon-suave
                         underline transition hover:text-fucsia"
            >
              quitar
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setTonos((p) => [...p, { nombre: "", colorHex: "#E5308A" }])}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-1
                     rounded-pastilla border-2 border-lila-suave px-4 text-sm
                     font-semibold text-lila transition hover:border-lila"
        >
          <IconoMas className="h-4 w-4" /> Agregar tono
        </button>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={producto?.activo ?? true}
          className="h-5 w-5 accent-[#E5308A]"
        />
        <span className="text-sm text-carbon">Visible en el catálogo</span>
      </label>

      {estado && !estado.ok && (
        <p role="alert" className="rounded-suave bg-fucsia/10 p-3 text-sm text-fucsia">
          {estado.error}
        </p>
      )}

      <div className="flex gap-3">
        <Boton type="submit" disabled={enviando || subiendo}>
          {enviando ? "Guardando…" : "Guardar producto"}
        </Boton>

        <Boton
          type="button"
          variante="fantasma"
          onClick={() => router.push("/admin/productos")}
        >
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
