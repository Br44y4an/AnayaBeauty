// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorTienda from "@/app/error";

describe("error.tsx", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ofrece volver a intentar con retry(), recargar y escribir por WhatsApp con el código del error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const error = Object.assign(new Error("falló"), { digest: "abc123" });

    render(<ErrorTienda error={error} retry={retry} />);

    expect(screen.getByRole("heading", { level: 1, name: "Algo no cargó bien" })).toBeInTheDocument();
    expect(screen.getByText("Lo que tienes en tu bolsa sigue guardado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar la página" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(retry).toHaveBeenCalledTimes(1);

    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain("(código abc123)");
    expect(screen.getByText("Código del error: abc123")).toBeInTheDocument();
  });

  it("sin digest no muestra un código vacío", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ErrorTienda error={new Error("falló")} retry={vi.fn()} />);

    expect(screen.queryByText(/Código del error/)).not.toBeInTheDocument();
    expect(decodeURIComponent(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href") ?? "")).not.toContain(
      "código"
    );
  });
});
