// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MisPedidos } from "@/components/tienda/MisPedidos";
import { guardarPedidoEnCelular } from "@/lib/celular";

describe("MisPedidos", () => {
  beforeEach(() => localStorage.clear());

  it("lista número, fecha y total de cada pedido guardado, el más reciente primero", () => {
    guardarPedidoEnCelular({ id: "id-97", numero: "AB-0097", total: 32000, fecha: "2026-11-09T15:00:00.000Z" });
    guardarPedidoEnCelular({ id: "id-98", numero: "AB-0098", total: 45000, fecha: "2026-11-10T22:42:00.000Z" });

    render(<MisPedidos />);

    const filas = screen.getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("AB-0098");
    expect(filas[0]).toHaveTextContent("10 nov, 5:42 p. m.");
    expect(filas[0]).toHaveTextContent("$45.000");
    expect(within(filas[0]).getByRole("link")).toHaveAttribute("href", "/pedido/id-98");
    expect(filas[1]).toHaveTextContent("AB-0097");
    expect(filas[1]).toHaveTextContent("$32.000");
  });

  it("sin pedidos explica dónde aparecen y ofrece volver al catálogo", () => {
    render(<MisPedidos />);

    expect(screen.getByText("Aquí aparecen los pedidos que confirmes desde este celular.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el catálogo" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("ignora lo guardado con otra forma en vez de romper", () => {
    localStorage.setItem("anaya-pedidos", JSON.stringify([{ id: 3 }, "basura"]));

    render(<MisPedidos />);

    expect(screen.getByText("Aquí aparecen los pedidos que confirmes desde este celular.")).toBeInTheDocument();
  });
});
