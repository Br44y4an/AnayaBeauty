// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarraBeneficios } from "@/components/tienda/BarraBeneficios";

describe("BarraBeneficios", () => {
  it("arma la franja con la regla de descuento y el precio por mayor", () => {
    render(<BarraBeneficios reglas={[{ montoMinimo: 50000, porcentaje: 5 }]} umbralPorMayor={200000} />);

    const franja = screen.getByRole("region", { name: "Precios y descuentos" });
    expect(franja).toHaveTextContent("Más unidades, mejor precio");
    expect(franja).toHaveTextContent("5 % menos desde $50.000");
    expect(franja).toHaveTextContent("Por mayor desde $200.000");
  });

  it("sin reglas y con umbral 0 no pinta nada", () => {
    const { container } = render(<BarraBeneficios reglas={[]} umbralPorMayor={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("ordena las reglas de menor a mayor monto y omite las que no descuentan", () => {
    render(
      <BarraBeneficios
        reglas={[
          { montoMinimo: 100000, porcentaje: 10 },
          { montoMinimo: 80000, porcentaje: 0 },
          { montoMinimo: 50000, porcentaje: 5 },
        ]}
        umbralPorMayor={0}
      />
    );

    const texto = screen.getByRole("region").textContent ?? "";
    expect(texto.indexOf("5 % menos")).toBeLessThan(texto.indexOf("10 % menos"));
    expect(texto).not.toMatch(/\b0\s%/);
    expect(texto).not.toContain("Por mayor");
  });

  it("sin reglas de descuento sigue anunciando el precio por mayor", () => {
    render(<BarraBeneficios reglas={[]} umbralPorMayor={200000} />);

    const franja = screen.getByRole("region");
    expect(franja).toHaveTextContent("Por mayor desde $200.000");
    expect(franja).not.toHaveTextContent("menos desde");
  });
});
