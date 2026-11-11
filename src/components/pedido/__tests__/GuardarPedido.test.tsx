// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { GuardarPedido } from "@/components/pedido/GuardarPedido";

const PEDIDO = { id: "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11", numero: "AB-0098", total: 45000, fecha: "2026-11-10T20:00:00.000Z" };
const guardados = () => JSON.parse(localStorage.getItem("anaya-pedidos") ?? "[]");

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", `/pedido/${PEDIDO.id}?nuevo=1`);
});

describe("GuardarPedido", () => {
  it("al montar guarda el pedido en este celular y no pinta nada", () => {
    const { container } = render(<GuardarPedido {...PEDIDO} />);

    expect(guardados()).toEqual([PEDIDO]);
    expect(container).toBeEmptyDOMElement();
  });

  it("quita «?nuevo=1» de la dirección: recargar o compartir el enlace no vuelve a marcarlo", () => {
    render(<GuardarPedido {...PEDIDO} />);

    expect(window.location.pathname).toBe(`/pedido/${PEDIDO.id}`);
    expect(window.location.search).toBe("");
  });

  it("sin almacenamiento disponible no rompe la página", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(() => render(<GuardarPedido {...PEDIDO} />)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
