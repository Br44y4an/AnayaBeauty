import { describe, it, expect, vi, beforeEach } from "vitest";

const { obtenerDatosBolsa } = vi.hoisted(() => ({ obtenerDatosBolsa: vi.fn() }));
vi.mock("@/lib/data/bolsa", () => ({ obtenerDatosBolsa }));

import { GET } from "@/app/api/bolsa/route";

const UUID = "0b8f3f4e-2c1a-4d7e-9a6b-5c4d3e2f1a0b";
const DATOS = { productos: [], reglas: [{ montoMinimo: 50000, porcentaje: 5 }], umbralPorMayor: 200000 };

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pedir = (ids: string) => GET(new Request(`http://localhost/api/bolsa?ids=${ids}`));

beforeEach(() => {
  obtenerDatosBolsa.mockReset();
  obtenerDatosBolsa.mockResolvedValue(DATOS);
});

describe("GET /api/bolsa", () => {
  it("solo consulta identificadores válidos y responde los datos", async () => {
    const respuesta = await pedir(`abc,${UUID}`);

    expect(obtenerDatosBolsa).toHaveBeenCalledWith([UUID]);
    expect(await respuesta.json()).toEqual(DATOS);
  });

  it("nunca se guarda en caché: el stock tiene que ser el de ahora", async () => {
    const respuesta = await pedir(UUID);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
  });

  it("recorta a 60 identificadores", async () => {
    const setenta = Array.from({ length: 70 }, (_, i) => uuid(i + 1));
    await pedir(setenta.join(","));

    expect(obtenerDatosBolsa).toHaveBeenCalledWith(setenta.slice(0, 60));
  });

  it("no repite un identificador", async () => {
    await pedir(`${UUID},${UUID}`);
    expect(obtenerDatosBolsa).toHaveBeenCalledWith([UUID]);
  });

  it("sin identificadores pide una bolsa vacía", async () => {
    await GET(new Request("http://localhost/api/bolsa"));
    expect(obtenerDatosBolsa).toHaveBeenCalledWith([]);
  });
});
