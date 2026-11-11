import { describe, it, expect, vi } from "vitest";

const { espia } = vi.hoisted(() => ({ espia: { llamadas: 0 } }));
vi.mock("node:crypto", async (original) => {
  const crypto = await original<typeof import("node:crypto")>();
  return {
    ...crypto,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      espia.llamadas++;
      return crypto.timingSafeEqual(a, b);
    },
  };
});

import { clavesIguales } from "@/lib/clave-segura";

describe("clavesIguales", () => {
  it("acepta la misma clave", () => {
    expect(clavesIguales("abc", "abc")).toBe(true);
  });

  it("rechaza una clave distinta del mismo largo", () => {
    expect(clavesIguales("abc", "abd")).toBe(false);
  });

  it("rechaza una clave de otro largo sin lanzar", () => {
    expect(clavesIguales("abc", "abcd")).toBe(false);
    expect(clavesIguales("abcd", "abc")).toBe(false);
  });

  it("rechaza si falta cualquiera de las dos", () => {
    expect(clavesIguales(null, "x")).toBe(false);
    expect(clavesIguales("x", null)).toBe(false);
    expect(clavesIguales(null, null)).toBe(false);
  });

  it("una clave vacía nunca coincide, ni siquiera con otra vacía", () => {
    expect(clavesIguales("", "")).toBe(false);
    expect(clavesIguales("", "x")).toBe(false);
  });

  it("compara tildes y símbolos byte a byte", () => {
    expect(clavesIguales("clave-ñ€", "clave-ñ€")).toBe(true);
    expect(clavesIguales("clave-ñ", "clave-n")).toBe(false);
  });

  it("compara en tiempo constante, también cuando los largos difieren", () => {
    espia.llamadas = 0;
    clavesIguales("abc", "abc");
    clavesIguales("abc", "una-clave-mucho-mas-larga");
    expect(espia.llamadas).toBe(2);
  });
});
