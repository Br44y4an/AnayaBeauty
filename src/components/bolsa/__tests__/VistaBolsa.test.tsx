// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DatosBolsa } from "@/lib/types";

const navegacion = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navegacion.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));
const servidor = vi.hoisted(() => ({ confirmarPedido: vi.fn() }));
vi.mock("@/app/(tienda)/carrito/actions", () => servidor);

import { VistaBolsa } from "@/components/bolsa/VistaBolsa";
import { Avisos } from "@/components/ui/Avisos";
import { useCarrito } from "@/lib/cart";
import { cerrarAviso } from "@/lib/avisos";

const ID_BRILLO = "00000000-0000-4000-8000-00000000000a";
const ID_BROCHA = "00000000-0000-4000-8000-00000000000b";
const ENVIO = "El envío se coordina por WhatsApp después de confirmar tu pedido.";

const DATOS: DatosBolsa = {
  productos: [
    {
      id: ID_BRILLO,
      referencia: "GLS735",
      nombre: "Brillo labial Oil Glazed Shine",
      imagenPrincipal: null,
      stock: 50,
      activo: true,
      escalones: [
        { minCantidad: 1, precioUnitario: 8000 },
        { minCantidad: 3, precioUnitario: 7500 },
      ],
      etiquetaVariante: "Tono",
      variantes: [
        { id: "t1", nombre: "Tono 1", colorHex: "#d3656e", orden: 1, agotado: false },
        { id: "t3", nombre: "Tono 3", colorHex: "#fd909f", orden: 3, agotado: false },
      ],
    },
    {
      id: ID_BROCHA,
      referencia: "BRI-52",
      nombre: "Brocha para polvo",
      imagenPrincipal: null,
      stock: 50,
      activo: true,
      escalones: [{ minCantidad: 1, precioUnitario: 16000 }],
      etiquetaVariante: "Color",
      variantes: [],
    },
  ],
  reglas: [{ montoMinimo: 50000, porcentaje: 5 }],
  umbralPorMayor: 200000,
};

const respuesta = (datos: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => datos });
let pedir: Mock;

function llenarBolsa() {
  const { agregar } = useCarrito.getState();
  agregar(ID_BRILLO, 2, { id: "t1", nombre: "Tono 1" });
  agregar(ID_BRILLO, 1, { id: "t3", nombre: "Tono 3" });
  agregar(ID_BROCHA, 1);
}

function montar() {
  return render(
    <>
      <VistaBolsa envioInfo={ENVIO} whatsappNegocio="573001112233" />
      <Avisos />
    </>
  );
}

const lista = () => screen.findByRole("list", { name: "Productos en tu bolsa" });

function completarDatos() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Gómez" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "300 123 4567" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Medellín" } });
}

beforeEach(() => {
  localStorage.clear();
  useCarrito.getState().vaciar();
  navegacion.push.mockReset();
  servidor.confirmarPedido.mockReset();
  pedir = vi.fn(async () => respuesta(DATOS));
  vi.stubGlobal("fetch", pedir);
});

afterEach(() => {
  act(() => cerrarAviso());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VistaBolsa", () => {
  it("agrupa por producto con su precio aplicado y el subtotal de cada uno", async () => {
    llenarBolsa();
    montar();
    await lista();

    expect(screen.getByRole("heading", { level: 1, name: "Tu bolsa" })).toBeInTheDocument();
    expect(screen.getByText("2 productos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brillo labial Oil Glazed Shine" })).toHaveAttribute(
      "href",
      "/producto/GLS735"
    );
    expect(screen.getByText("Ref. GLS735")).toBeInTheDocument();
    expect(screen.getByText("$7.500 c/u · precio de 3 o más")).toBeInTheDocument();
    expect(screen.getByText("$22.500")).toBeInTheDocument();
    expect(screen.getByText("Tono 1")).toBeInTheDocument();
    expect(screen.getByText("Tono 3")).toBeInTheDocument();
  });

  it("quitar una variante muestra un aviso con «Deshacer» que la restaura", async () => {
    llenarBolsa();
    montar();
    await lista();

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar Brillo labial Oil Glazed Shine, Tono 1 de la bolsa" })
    );

    expect(useCarrito.getState().lineas.map((l) => l.tonoNombre)).toEqual(["Tono 3", null]);
    expect(screen.queryByText("Tono 1")).not.toBeInTheDocument();
    expect(screen.getByText("Quitaste Tono 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(useCarrito.getState().lineas[0]).toMatchObject({ tonoNombre: "Tono 1", cantidad: 2 });
    expect(screen.getByText("Tono 1")).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("bajar a cero con «−» también quita la línea y ofrece deshacer", async () => {
    llenarBolsa();
    montar();
    await lista();

    fireEvent.click(screen.getByRole("button", { name: "Quitar uno de Brillo labial Oil Glazed Shine, Tono 3" }));

    expect(useCarrito.getState().lineas.map((l) => l.tonoNombre)).toEqual(["Tono 1", null]);
    expect(screen.getByText("Quitaste Tono 3")).toBeInTheDocument();
  });

  it("con campos vacíos la barra dice «Completar mis datos» y al tocarla enfoca el primero vacío", async () => {
    llenarBolsa();
    montar();
    await lista();

    fireEvent.click(screen.getByRole("button", { name: "Completar mis datos" }));
    expect(screen.getByLabelText("Nombre")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Gómez" } });
    fireEvent.click(screen.getByRole("button", { name: "Completar mis datos" }));
    expect(screen.getByLabelText("WhatsApp")).toHaveFocus();
  });

  it("con los datos completos dice «Confirmar pedido · $X» y envía el formulario", async () => {
    llenarBolsa();
    montar();
    await lista();

    completarDatos();

    const boton = screen.getByRole("button", { name: "Confirmar pedido · $38.500" });
    expect(boton).toHaveAttribute("type", "submit");
    expect(boton).toHaveAttribute("form", "form-pedido");
    expect(screen.queryByRole("button", { name: "Completar mis datos" })).not.toBeInTheDocument();
  });

  it("muestra «Total productos», el progreso al descuento y la línea de envío", async () => {
    llenarBolsa();
    montar();
    await lista();

    expect(screen.getAllByText("Total productos").length).toBeGreaterThan(0);
    expect(screen.getByText(`Envío: ${ENVIO}`)).toBeInTheDocument();
    expect(screen.getByText("Te faltan $11.500 para el 5 % de descuento")).toBeInTheDocument();
  });

  it("con un pedido reciente en el celular avisa que este va como adicional", async () => {
    localStorage.setItem(
      "anaya-pedidos",
      JSON.stringify([
        { id: "p-1", numero: "AB-0098", total: 45000, fecha: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
      ])
    );
    llenarBolsa();
    montar();
    await lista();

    expect(screen.getByText(/Ya hiciste el pedido AB-0098/)).toHaveTextContent(
      "Este se enviará como adicional para empacarlo junto."
    );
    expect(document.querySelector('input[name="adicional"]')).toHaveValue("AB-0098");
  });

  it("marca en la línea lo que cambió por stock", async () => {
    pedir.mockResolvedValue(
      respuesta({
        ...DATOS,
        productos: [
          {
            ...DATOS.productos[0],
            variantes: [DATOS.productos[0].variantes[0], { ...DATOS.productos[0].variantes[1], agotado: true }],
          },
          { ...DATOS.productos[1], stock: 0 },
        ],
      })
    );
    const { agregar } = useCarrito.getState();
    agregar(ID_BRILLO, 2, { id: "t1", nombre: "Tono 1" });
    agregar(ID_BRILLO, 1, { id: "t3", nombre: "Tono 3" });
    agregar(ID_BROCHA, 1);
    montar();
    await lista();

    expect(screen.getByText("Este tono se agotó")).toBeInTheDocument();
    expect(screen.getByText("Este producto se agotó")).toBeInTheDocument();
  });

  it("ajusta la cantidad cuando quedan menos unidades y lo dice", async () => {
    pedir.mockResolvedValue(respuesta({ ...DATOS, productos: [{ ...DATOS.productos[1], stock: 2 }] }));
    useCarrito.getState().agregar(ID_BROCHA, 5);
    montar();
    await lista();

    expect(screen.getByText("Solo quedan 2: ajustamos la cantidad")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cantidad de Brocha para polvo" })).toHaveTextContent("2");
    completarDatos();
    expect(screen.getByRole("button", { name: "Confirmar pedido · $32.000" })).toBeInTheDocument();
  });

  it("si no carga, ofrece «Volver a intentar» y de verdad vuelve a pedir", async () => {
    pedir.mockResolvedValueOnce(respuesta({}, false));
    llenarBolsa();
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Volver a intentar" }));

    await lista();
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("vacía muestra el mensaje, el enlace al catálogo y los pedidos del celular", async () => {
    localStorage.setItem(
      "anaya-pedidos",
      JSON.stringify([{ id: "p-7", numero: "AB-0077", total: 45000, fecha: "2026-11-01T15:00:00.000Z" }])
    );
    montar();

    expect(await screen.findByText("Tu bolsa está vacía")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el catálogo" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /AB-0077/ })).toHaveAttribute("href", "/pedido/p-7");
    expect(pedir).not.toHaveBeenCalled();
  });

  it("al confirmar muestra «Confirmando tu pedido…», vacía la bolsa y abre el pedido", async () => {
    let responder: (r: unknown) => void = () => {};
    servidor.confirmarPedido.mockReturnValue(new Promise((r) => (responder = r)));
    llenarBolsa();
    montar();
    await lista();
    completarDatos();

    fireEvent.submit(screen.getByRole("form", { name: "Tus datos" }));

    expect(await screen.findByText("Confirmando tu pedido…")).toBeInTheDocument();
    const [, enviado] = servidor.confirmarPedido.mock.calls[0] as [unknown, FormData];
    expect(JSON.parse(String(enviado.get("items")))).toEqual([
      { producto_id: ID_BRILLO, cantidad: 2, tono: "Tono 1" },
      { producto_id: ID_BRILLO, cantidad: 1, tono: "Tono 3" },
      { producto_id: ID_BROCHA, cantidad: 1, tono: null },
    ]);
    expect(enviado.get("clave")).toBe(useCarrito.getState().claveEnvio);

    await act(async () => responder({ ok: true, id: "pedido-1", numero: "AB-0100", total: 38500 }));

    await waitFor(() => expect(navegacion.push).toHaveBeenCalledWith("/pedido/pedido-1?nuevo=1"));
    expect(useCarrito.getState().lineas).toEqual([]);
    expect(screen.getByText("Confirmando tu pedido…")).toBeInTheDocument();
  });

  it("un error de un campo se ve junto a ese campo", async () => {
    servidor.confirmarPedido.mockResolvedValue({
      ok: false,
      campo: "whatsapp",
      mensaje: "Revisa tu número de WhatsApp. Ej.: 300 123 4567.",
    });
    llenarBolsa();
    montar();
    await lista();
    completarDatos();

    fireEvent.submit(screen.getByRole("form", { name: "Tus datos" }));

    await waitFor(() =>
      expect(screen.getByLabelText("WhatsApp")).toHaveAccessibleDescription(/Revisa tu número de WhatsApp/)
    );
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("300 123 4567");
    expect(useCarrito.getState().lineas).toHaveLength(3);
  });

  it("un error de la bolsa se ve arriba del botón con WhatsApp y refresca el stock", async () => {
    servidor.confirmarPedido.mockResolvedValue({
      ok: false,
      campo: "bolsa",
      codigo: "SIN_STOCK",
      mensaje: "De Brocha para polvo solo quedan 0. Ajusta la cantidad y confirma de nuevo.",
    });
    llenarBolsa();
    montar();
    await lista();
    completarDatos();

    fireEvent.submit(screen.getByRole("form", { name: "Tus datos" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("De Brocha para polvo solo quedan 0")
    );
    expect(screen.getByRole("link", { name: "Escríbenos por WhatsApp" }).getAttribute("href")).toContain(
      "wa.me/573001112233"
    );
    await waitFor(() => expect(pedir).toHaveBeenCalledTimes(2));
  });
});
