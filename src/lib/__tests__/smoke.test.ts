import { describe, it, expect } from "vitest";
import { saludo } from "@/lib/smoke";

describe("andamiaje", () => {
  it("resuelve el alias @ y ejecuta TypeScript", () => {
    expect(saludo()).toBe("Anaya Beauty");
  });
});
