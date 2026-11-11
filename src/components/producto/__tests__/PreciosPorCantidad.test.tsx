// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreciosPorCantidad } from "@/components/producto/PreciosPorCantidad";

const ESCALONES = [
  { minCantidad: 6, precioUnitario: 6500 },
  { minCantidad: 1, precioUnitario: 8000 },
  { minCantidad: 3, precioUnitario: 7500 },
];

const fila = (texto: string) => screen.getByText(texto).closest("li");

describe("PreciosPorCantidad", () => {
  it("muestra una fila por escalón, de menor a mayor, con su precio", () => {
    render(<PreciosPorCantidad escalones={ESCALONES} unidadesTotales={0} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("listitem")[0]).toBe(fila("1 u"));
    expect(fila("1 u")).toHaveTextContent("$8.000");
    expect(fila("3+")).toHaveTextContent("$7.500");
    expect(fila("6+")).toHaveTextContent("$6.500");
  });

  it("con 4 unidades entre bolsa y selección resalta «3+»", () => {
    render(<PreciosPorCantidad escalones={ESCALONES} unidadesTotales={4} />);

    expect(fila("3+")).toHaveAttribute("aria-current", "true");
    expect(fila("1 u")).not.toHaveAttribute("aria-current");
    expect(fila("6+")).not.toHaveAttribute("aria-current");
  });

  it("sin nada elegido rige el precio de una unidad", () => {
    render(<PreciosPorCantidad escalones={ESCALONES} unidadesTotales={0} />);
    expect(fila("1 u")).toHaveAttribute("aria-current", "true");
  });

  it("el precio grande es el del escalón vigente, por unidad", () => {
    render(<PreciosPorCantidad escalones={ESCALONES} unidadesTotales={7} />);
    expect(screen.getByTestId("precio-vigente")).toHaveTextContent("$6.500 c/u");
  });

  it("con un solo escalón no pinta la tabla, solo el precio", () => {
    render(<PreciosPorCantidad escalones={[{ minCantidad: 1, precioUnitario: 20000 }]} unidadesTotales={2} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByTestId("precio-vigente")).toHaveTextContent("$20.000 c/u");
  });

  it("con algo elegido dice cuánto falta para el escalón siguiente", () => {
    render(
      <PreciosPorCantidad
        escalones={ESCALONES}
        unidadesTotales={1}
        siguiente={{ faltan: 2, precioUnitario: 7500 }}
      />
    );
    expect(screen.getByText("Con 2 más pagas $7.500 c/u.")).toBeInTheDocument();
  });

  it("sin nada elegido no habla del escalón siguiente", () => {
    render(
      <PreciosPorCantidad
        escalones={ESCALONES}
        unidadesTotales={0}
        siguiente={{ faltan: 3, precioUnitario: 7500 }}
      />
    );
    expect(screen.queryByText(/más pagas/)).not.toBeInTheDocument();
  });

  it("muestra la nota cuando la hay", () => {
    render(
      <PreciosPorCantidad
        escalones={ESCALONES}
        unidadesTotales={1}
        nota="Puedes mezclar tonos: cuentan juntos para el precio."
      />
    );
    expect(screen.getByText("Puedes mezclar tonos: cuentan juntos para el precio.")).toBeInTheDocument();
  });
});
