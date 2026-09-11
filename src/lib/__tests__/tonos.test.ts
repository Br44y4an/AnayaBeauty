import { describe, it, expect } from "vitest";
import {
  hexAHsl,
  familiaDeColor,
  filtrarTonos,
  agruparTonos,
  necesitaBorde,
  textoSobre,
  FAMILIAS,
} from "@/lib/tonos";
import type { Tono } from "@/lib/types";

function tono(nombre: string, colorHex: string, orden = 0): Tono {
  return { id: `${nombre}-${colorHex}`, nombre, colorHex, orden };
}

describe("hexAHsl", () => {
  it("convierte un hex de 6 dígitos", () => {
    const hsl = hexAHsl("#ff0000");
    expect(hsl).not.toBeNull();
    expect(hsl!.h).toBeCloseTo(0);
    expect(hsl!.s).toBeCloseTo(1);
    expect(hsl!.l).toBeCloseTo(0.5);
  });

  it("acepta el atajo de 3 dígitos", () => {
    expect(hexAHsl("#f00")).toEqual(hexAHsl("#ff0000"));
  });

  it("acepta el hex sin almohadilla", () => {
    expect(hexAHsl("00ff00")).toEqual(hexAHsl("#00ff00"));
  });

  it("da saturación cero en los grises", () => {
    expect(hexAHsl("#808080")!.s).toBe(0);
  });

  it("devuelve null si no es un color", () => {
    expect(hexAHsl("")).toBeNull();
    expect(hexAHsl("rosita")).toBeNull();
    expect(hexAHsl("#12345")).toBeNull();
    expect(hexAHsl("#gggggg")).toBeNull();
  });
});

describe("familiaDeColor", () => {
  it("clasifica los colores básicos donde la clienta los buscaría", () => {
    expect(familiaDeColor("#e01b24")).toBe("rojos");
    expect(familiaDeColor("#f5c211")).toBe("amarillos");
    expect(familiaDeColor("#2ec27e")).toBe("verdes");
    expect(familiaDeColor("#1c71d8")).toBe("azules");
    expect(familiaDeColor("#9141ac")).toBe("morados");
    expect(familiaDeColor("#e5308a")).toBe("rosados");
  });

  it("separa los nudes de los naranjas vivos", () => {
    // La regla que más importa en maquillaje: sin ella un beige apagado
    // caía junto a un naranja neón y la paleta no se podía leer.
    expect(familiaDeColor("#d8b49c")).toBe("nudes");
    expect(familiaDeColor("#c9a086")).toBe("nudes");
    expect(familiaDeColor("#ff6600")).toBe("naranjas");
  });

  it("manda blancos, negros y grises a neutros", () => {
    expect(familiaDeColor("#ffffff")).toBe("neutros");
    expect(familiaDeColor("#000000")).toBe("neutros");
    expect(familiaDeColor("#9a9a9a")).toBe("neutros");
  });

  it("no revienta con un color inválido", () => {
    expect(familiaDeColor("no-es-un-color")).toBe("neutros");
  });

  it("siempre devuelve una familia conocida", () => {
    const claves = FAMILIAS.map((f) => f.clave);
    for (let h = 0; h < 360; h += 7) {
      const color = hslAHexAproximado(h, 0.7, 0.5);
      expect(claves).toContain(familiaDeColor(color));
    }
  });
});

describe("filtrarTonos", () => {
  const paleta = [
    tono("Rubí", "#e01b24"),
    tono("Rosa Palo", "#e8b4c8"),
    tono("Nude Café", "#c9a086"),
  ];

  it("devuelve todo si no hay búsqueda", () => {
    expect(filtrarTonos(paleta, "")).toHaveLength(3);
    expect(filtrarTonos(paleta, "   ")).toHaveLength(3);
  });

  it("ignora tildes y mayúsculas", () => {
    // La clienta escribe "rubi" en el teclado del celular, sin tilde.
    expect(filtrarTonos(paleta, "rubi")).toHaveLength(1);
    expect(filtrarTonos(paleta, "RUBÍ")).toHaveLength(1);
  });

  it("busca en cualquier parte del nombre", () => {
    expect(filtrarTonos(paleta, "palo")[0].nombre).toBe("Rosa Palo");
  });

  it("devuelve vacío si no hay coincidencias", () => {
    expect(filtrarTonos(paleta, "turquesa")).toHaveLength(0);
  });
});

describe("agruparTonos", () => {
  it("no agrupa una paleta corta: partirla añade ruido", () => {
    const paleta = [tono("A", "#e01b24"), tono("B", "#1c71d8")];
    const grupos = agruparTonos(paleta);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].etiqueta).toBe("");
    expect(grupos[0].tonos).toHaveLength(2);
  });

  it("agrupa por familia cuando la paleta es larga", () => {
    const paleta = [
      tono("R1", "#e01b24"),
      tono("R2", "#c01515"),
      tono("A1", "#1c71d8"),
      tono("A2", "#3584e4"),
      tono("M1", "#9141ac"),
      tono("N1", "#c9a086"),
      tono("N2", "#d8b49c"),
      tono("V1", "#2ec27e"),
      tono("Y1", "#f5c211"),
      tono("P1", "#e5308a"),
    ];

    const grupos = agruparTonos(paleta);
    expect(grupos.length).toBeGreaterThan(1);

    const rojos = grupos.find((g) => g.clave === "rojos");
    expect(rojos?.tonos).toHaveLength(2);
  });

  it("no devuelve grupos vacíos y respeta el orden de FAMILIAS", () => {
    const paleta = Array.from({ length: 12 }, (_, i) =>
      tono(`T${i}`, i % 2 === 0 ? "#e01b24" : "#1c71d8")
    );

    const grupos = agruparTonos(paleta);
    expect(grupos.every((g) => g.tonos.length > 0)).toBe(true);

    const orden = FAMILIAS.map((f) => f.clave);
    const posiciones = grupos.map((g) => orden.indexOf(g.clave));
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it("no pierde ningún tono al agrupar", () => {
    const paleta = Array.from({ length: 30 }, (_, i) =>
      tono(`T${i}`, hslAHexAproximado(i * 12, 0.6, 0.5))
    );

    const total = agruparTonos(paleta).reduce((n, g) => n + g.tonos.length, 0);
    expect(total).toBe(30);
  });

  it("devuelve vacío si no hay tonos", () => {
    expect(agruparTonos([])).toEqual([]);
  });
});

describe("necesitaBorde", () => {
  it("pide borde para los tonos casi blancos, que si no desaparecen", () => {
    expect(necesitaBorde("#ffffff")).toBe(true);
    expect(necesitaBorde("#fdf6f0")).toBe(true);
  });

  it("no pide borde para un color con cuerpo", () => {
    expect(necesitaBorde("#e01b24")).toBe(false);
  });

  it("pide borde si el color no se pudo leer", () => {
    expect(necesitaBorde("???")).toBe(true);
  });
});

describe("textoSobre", () => {
  it("usa texto oscuro encima de colores claros y claro encima de oscuros", () => {
    expect(textoSobre("#ffffff")).toBe("oscuro");
    expect(textoSobre("#000000")).toBe("claro");
    expect(textoSobre("#e01b24")).toBe("claro");
  });
});

/** Ayuda de prueba: HSL → hex, para generar paletas sintéticas. */
function hslAHexAproximado(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  const aHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${aHex(r)}${aHex(g)}${aHex(b)}`;
}
