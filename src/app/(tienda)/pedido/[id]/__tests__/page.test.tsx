// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ConfiguracionPublica, EstadoPedido, Pedido } from "@/lib/types";

vi.mock("server-only", () => ({}));
const datos = vi.hoisted(() => ({ pedido: null as Pedido | null, config: null as ConfiguracionPublica | null }));
vi.mock("@/lib/data/pedido-publico", () => ({ obtenerPedidoPublico: async () => datos.pedido }));
vi.mock("@/lib/data/configuracion", () => ({ obtenerConfiguracionPublica: async () => datos.config }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import PaginaPedido from "@/app/(tienda)/pedido/[id]/page";

const ID = "5d0c7c43-58f4-4c5e-9a43-2f3c8f0c1a11";
const ENVIO = "El envío se coordina por WhatsApp después de confirmar tu pedido.";

const PEDIDO: Pedido = {
  id: ID,
  numeroPedido: "AB-0098",
  clienteNombre: "María Gómez",
  clienteWhatsapp: "300 123 4567",
  clienteCiudad: "Medellín",
  notasCliente: null,
  subtotal: 38500,
  descuento: 0,
  porcentajeDescuento: 0,
  porMayor: false,
  total: 38500,
  estado: "nuevo",
  notasAdmin: null,
  creadoEn: "2026-11-10T20:00:00.000Z",
  lineas: [
    { id: "l1", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 1", cantidad: 2, precioUnitarioAplicado: 7500, subtotal: 15000 },
    { id: "l2", referencia: "GLS735", nombre: "Brillo labial", tono: "Tono 3", cantidad: 1, precioUnitarioAplicado: 7500, subtotal: 7500 },
    { id: "l3", referencia: "BRI-52", nombre: "Brocha para polvo", tono: null, cantidad: 1, precioUnitarioAplicado: 16000, subtotal: 16000 },
  ],
};

const CONFIG: ConfiguracionPublica = {
  mensajeExito: "Gracias por comprar en Anaya Beauty.",
  umbralPorMayor: 200000,
  whatsappNegocio: "573001112233",
  envioInfo: ENVIO,
  pago: { metodo: "Nequi", numero: "300 765 4321", titular: "Anaya Beauty" },
};

async function montar(cambios: Partial<Pedido> = {}, config: Partial<ConfiguracionPublica> = {}, nuevo?: string) {
  datos.pedido = { ...PEDIDO, ...cambios };
  datos.config = { ...CONFIG, ...config };
  const pagina = await PaginaPedido({
    params: Promise.resolve({ id: ID }),
    searchParams: Promise.resolve(nuevo ? { nuevo } : {}),
  });
  return render(pagina);
}

beforeEach(() => localStorage.clear());

describe("Página del pedido", () => {
  it("abre con «¡Pedido confirmado!», el número grande y el mensaje de la tienda", async () => {
    await montar();

    expect(screen.getByRole("heading", { level: 1, name: "¡Pedido confirmado!" })).toBeInTheDocument();
    expect(screen.getByText("Pedido AB-0098")).toBeInTheDocument();
    expect(screen.getByText("Guarda este número para cualquier consulta.")).toBeInTheDocument();
    expect(screen.getByText("Gracias por comprar en Anaya Beauty.")).toBeInTheDocument();
  });

  it("pone primero cómo pagar y después los tres pasos de qué sigue", async () => {
    await montar();

    const pago = screen.getByRole("region", { name: "Cómo pagar" });
    const pasos = screen.getByRole("region", { name: "Qué sigue" });
    expect(pago.compareDocumentPosition(pasos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(pago).getByText("Transfiere $38.500 por Nequi")).toBeInTheDocument();
    expect(within(pasos).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/");
  });

  it("sin mensaje de la tienda ni datos de pago no deja huecos", async () => {
    await montar({}, { mensajeExito: null, pago: { metodo: null, numero: null, titular: null } });

    expect(screen.getByText("Te enviamos los datos de pago por WhatsApp")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/);
  });

  it("recién confirmado lo guarda en este celular", async () => {
    await montar({}, {}, "1");

    expect(JSON.parse(localStorage.getItem("anaya-pedidos") ?? "[]")).toEqual([
      { id: ID, numero: "AB-0098", total: 38500, fecha: PEDIDO.creadoEn },
    ]);
  });

  it("abierto desde un enlace (sin venir de confirmar) no lo guarda en este celular", async () => {
    await montar();

    expect(localStorage.getItem("anaya-pedidos")).toBeNull();
  });

  it.each<[EstadoPedido, string]>([
    ["pagado", "Recibimos tu pago"],
    ["enviado", "Tu pedido ya salió"],
  ])("un pedido %s no vuelve a pedir el pago", async (estado, aviso) => {
    await montar({ estado });

    expect(screen.queryByRole("region", { name: "Cómo pagar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ya pagué: enviar comprobante" })).not.toBeInTheDocument();
    expect(screen.getByText(aviso, { exact: false })).toBeInTheDocument();
  });

  it("un pedido cancelado lo dice y no muestra cómo pagar", async () => {
    await montar({ estado: "cancelado" });

    expect(screen.getByRole("heading", { level: 1, name: "Pedido cancelado" })).toBeInTheDocument();
    expect(screen.queryByText("¡Pedido confirmado!")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Cómo pagar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escríbenos por WhatsApp/ }).getAttribute("href")).toContain(
      "wa.me/573001112233"
    );
  });

  it("un pedido que no existe da 404", async () => {
    datos.pedido = null;
    datos.config = CONFIG;

    await expect(
      PaginaPedido({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
