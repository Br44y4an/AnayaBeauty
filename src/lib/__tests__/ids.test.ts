import { describe, it, expect } from "vitest";
import { esUuid } from "@/lib/ids";

describe("esUuid", () => {
  it("acepta un UUID en minúsculas o mayúsculas", () => {
    expect(esUuid("0b8f3f4e-2c1a-4d7e-9a6b-5c4d3e2f1a0b")).toBe(true);
    expect(esUuid("0B8F3F4E-2C1A-4D7E-9A6B-5C4D3E2F1A0B")).toBe(true);
  });

  it("rechaza lo que no lo es", () => {
    for (const valor of ["abc", "", " 0b8f3f4e-2c1a-4d7e-9a6b-5c4d3e2f1a0b", "0b8f3f4e2c1a4d7e9a6b5c4d3e2f1a0b"]) {
      expect(esUuid(valor)).toBe(false);
    }
    expect(esUuid(null)).toBe(false);
    expect(esUuid(42)).toBe(false);
  });
});
