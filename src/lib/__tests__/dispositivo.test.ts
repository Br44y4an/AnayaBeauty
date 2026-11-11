import { describe, it, expect, vi, afterEach } from "vitest";
import { vibrar } from "@/lib/dispositivo";

afterEach(() => vi.unstubAllGlobals());

describe("vibrar", () => {
  it("vibra 15 ms por defecto", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });

    vibrar();
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it("acepta otra duración", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });

    vibrar(30);
    expect(vibrate).toHaveBeenCalledWith(30);
  });

  it("encuentra la vibración en el prototipo, que es donde la ponen los navegadores", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", Object.create({ vibrate }));

    vibrar();
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it("no hace nada donde no se puede vibrar (iPhone, servidor)", () => {
    vi.stubGlobal("navigator", {});
    expect(() => vibrar()).not.toThrow();

    vi.stubGlobal("navigator", undefined);
    expect(() => vibrar()).not.toThrow();
  });
});
