// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Boton, BotonEnlace, estilosBoton } from "@/components/ui/Boton";

describe("Boton", () => {
  it("cargando pone aria-busy y lo deshabilita para evitar el doble envío", () => {
    render(<Boton cargando>Confirmar pedido</Boton>);

    const boton = screen.getByRole("button", { name: "Confirmar pedido" });
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(boton).toBeDisabled();
  });

  it("sin cargar no lleva aria-busy", () => {
    render(<Boton>Agregar</Boton>);
    expect(screen.getByRole("button", { name: "Agregar" })).not.toHaveAttribute("aria-busy");
  });

  it("conserva las props del botón nativo", () => {
    render(
      <Boton type="submit" variante="secundario" tamano="grande" ancho disabled>
        Entrar
      </Boton>
    );

    const boton = screen.getByRole("button", { name: "Entrar" });
    expect(boton).toHaveAttribute("type", "submit");
    expect(boton).toBeDisabled();
    expect(boton.className).toContain("w-full");
  });
});

describe("BotonEnlace", () => {
  it("es un <a> sin <button> adentro", () => {
    render(
      <BotonEnlace href="/carrito" variante="contorno">
        Ver el catálogo
      </BotonEnlace>
    );

    const enlace = screen.getByRole("link", { name: "Ver el catálogo" });
    expect(enlace.tagName).toBe("A");
    expect(enlace).toHaveAttribute("href", "/carrito");
    expect(enlace.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("estilosBoton", () => {
  it("da 44, 52 y 56 px de alto según el tamaño", () => {
    expect(estilosBoton({ tamano: "compacto" })).toContain("min-h-11");
    expect(estilosBoton()).toContain("min-h-13");
    expect(estilosBoton({ tamano: "grande" })).toContain("min-h-14");
  });

  it("solo el primario usa el acento", () => {
    expect(estilosBoton({ variante: "primario" })).toContain("bg-acento");
    for (const variante of ["secundario", "contorno", "fantasma", "peligro"] as const) {
      expect(estilosBoton({ variante })).not.toMatch(/acento/);
    }
  });

  it("el hover y el presionado solo actúan si no está deshabilitado (tampoco mientras carga)", () => {
    for (const variante of ["primario", "secundario", "contorno", "fantasma", "peligro"] as const) {
      const clases = estilosBoton({ variante }).split(" ");
      expect(clases.filter((clase) => /^(hover|active):/.test(clase))).toEqual([]);
      expect(clases.some((clase) => clase.startsWith("not-disabled:hover:"))).toBe(true);
    }
  });

  it("añade el ancho completo y las clases extra", () => {
    const clases = estilosBoton({ ancho: true, className: "mt-4" });
    expect(clases).toContain("w-full");
    expect(clases).toContain("mt-4");
  });
});
