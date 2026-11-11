import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { invalidarCatalogo, invalidarConfig, invalidarPrecios } from "@/lib/data/invalidar";

beforeEach(() => revalidateTag.mockReset());

describe("invalidar", () => {
  it("cada acción expira al instante solo su etiqueta", () => {
    invalidarCatalogo();
    invalidarPrecios();
    invalidarConfig();

    expect(revalidateTag.mock.calls).toEqual([
      ["catalogo", { expire: 0 }],
      ["precios", { expire: 0 }],
      ["config", { expire: 0 }],
    ]);
  });
});
