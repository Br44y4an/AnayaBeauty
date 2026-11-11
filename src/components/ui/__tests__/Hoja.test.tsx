// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Hoja } from "@/components/ui/Hoja";

function Ejemplo({ alCerrar = () => {} }: { alCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)}>
        Abrir
      </button>
      <Hoja
        abierta={abierta}
        alCerrar={() => {
          alCerrar();
          setAbierta(false);
        }}
        titulo="Buscar"
        pie={<button type="button">Ver resultados</button>}
      >
        <p>Contenido</p>
      </Hoja>
    </>
  );
}

describe("Hoja", () => {
  it("cerrada no pinta nada", () => {
    render(<Ejemplo />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al abrir es un diálogo modal con nombre y el foco pasa adentro", () => {
    render(<Ejemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    abrir.focus();

    fireEvent.click(abrir);

    const dialogo = screen.getByRole("dialog", { name: "Buscar" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("button", { name: "Ver resultados" })).toBeInTheDocument();
  });

  it("Escape llama alCerrar una sola vez", () => {
    const alCerrar = vi.fn();
    render(<Hoja abierta alCerrar={alCerrar} titulo="Buscar">contenido</Hoja>);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("el botón Cerrar llama alCerrar", () => {
    const alCerrar = vi.fn();
    render(<Hoja abierta alCerrar={alCerrar} titulo="Buscar">contenido</Hoja>);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("al cerrar sale con animación y devuelve el foco a quien la abrió", () => {
    vi.useFakeTimers();
    try {
      render(<Ejemplo />);
      const abrir = screen.getByRole("button", { name: "Abrir" });
      abrir.focus();
      fireEvent.click(abrir);

      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(document.activeElement).toBe(abrir);

      act(() => vi.advanceTimersByTime(200));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("con el título oculto sigue nombrando al diálogo", () => {
    render(
      <Hoja abierta alCerrar={() => {}} titulo="Brillo labial" tituloVisible={false}>
        contenido
      </Hoja>
    );
    expect(screen.getByRole("dialog", { name: "Brillo labial" })).toBeInTheDocument();
  });

  it("sigue aceptando el uso viejo (sin abierta, con descripción)", () => {
    render(
      <Hoja titulo="Labial" descripcion="Ref. GLS735" alCerrar={() => {}}>
        contenido
      </Hoja>
    );
    expect(screen.getByRole("dialog", { name: "Labial" })).toHaveTextContent("Ref. GLS735");
  });
});
