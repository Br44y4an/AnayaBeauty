// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VistaImportacion } from "../VistaImportacion";
import type { VistaPrevia } from "../actions";

const VISTA: VistaPrevia = {
  errores: ["línea 4 (REF-3): el stock «mucho» no es un número entero"],
  avisos: ["Línea 5 (REF-9): no existe la categoría «Espejitos»; se crea sin categoría."],
  nuevos: [{ referencia: "REF-9", nombre: "Espejo de mano", precio: 15000, stock: 4 }],
  cambios: [
    { referencia: "REF-1", nombre: "Brillo labial", lineas: ["Stock: 12 → 0", "Precio desde 3: $9.000 → $9.500"] },
  ],
  sinCambios: 20,
  cambianPrecio: 1,
  quedanSinStock: 1,
};

function mostrar(vista: VistaPrevia = VISTA) {
  const alImportar = vi.fn();
  const alCambiarPublicar = vi.fn();
  render(
    <VistaImportacion
      vista={vista}
      publicar
      alCambiarPublicar={alCambiarPublicar}
      importando={false}
      alImportar={alImportar}
    />
  );
  return { alImportar, alCambiarPublicar };
}

describe("VistaImportacion", () => {
  it("resume lo que va a pasar antes de escribir nada", () => {
    const { alImportar } = mostrar();

    expect(screen.getByText("1 con precios nuevos · 1 sin unidades")).toBeInTheDocument();
    expect(screen.getByText("1 producto quedaría con 0 unidades y la tienda lo mostraría agotado.")).toBeInTheDocument();
    expect(screen.getByText("Línea 4 (REF-3): el stock «mucho» no es un número entero")).toBeInTheDocument();
    expect(screen.getByText("Stock: 12 → 0")).toBeInTheDocument();
    expect(screen.getByText("Espejo de mano")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear 1 producto y actualizar 1 producto" }));
    expect(alImportar).toHaveBeenCalledOnce();
  });

  it("deja crear los productos nuevos ocultos", () => {
    const { alCambiarPublicar } = mostrar();
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar los productos nuevos en la tienda" }));
    expect(alCambiarPublicar).toHaveBeenCalledWith(false);
  });

  it("sin nada que cambiar no ofrece importar", () => {
    mostrar({ ...VISTA, nuevos: [], cambios: [], errores: [], avisos: [], cambianPrecio: 0, quedanSinStock: 0 });
    expect(screen.getByText("Este archivo no cambia nada: los productos ya tienen esos datos.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
