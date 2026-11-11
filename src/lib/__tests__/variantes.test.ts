import { describe, it, expect } from "vitest";
import {
  ETIQUETAS_VARIANTE,
  esNumeracionDeFoto,
  etiquetaPorDefecto,
  muestrasConfiables,
  nombreVariante,
  pluralVariante,
  resolverEtiqueta,
  tituloSelector,
  unaVariante,
  verboElegir,
} from "@/lib/variantes";
import type { EtiquetaVariante } from "@/lib/types";

const hex = (...colores: string[]) => colores.map((colorHex) => ({ colorHex }));
const nombres = (...n: string[]) => n.map((nombre) => ({ nombre }));

describe("pluralVariante", () => {
  it.each<[EtiquetaVariante, number, string]>([
    ["Tono", 1, "1 tono"],
    ["Tono", 6, "6 tonos"],
    ["Color", 1, "1 color"],
    ["Color", 4, "4 colores"],
    ["Diseño", 3, "3 diseños"],
    ["Modelo", 2, "2 modelos"],
    ["Aroma", 5, "5 aromas"],
    ["Largo", 3, "3 largos"],
    ["Paleta", 2, "2 paletas"],
  ])("%s × %i → %s", (etiqueta, n, texto) => {
    expect(pluralVariante(etiqueta, n)).toBe(texto);
  });
});

describe("textos con la etiqueta", () => {
  it("arma el verbo del botón de la tarjeta", () => {
    expect(verboElegir("Color")).toBe("Elegir color");
    expect(verboElegir("Diseño")).toBe("Elegir diseño");
  });

  it("concuerda el artículo del título con la etiqueta", () => {
    expect(tituloSelector("Tono")).toBe("Elige el tono");
    expect(tituloSelector("Paleta")).toBe("Elige la paleta");
  });

  it("concuerda el artículo indefinido", () => {
    expect(unaVariante("Tono")).toBe("un tono");
    expect(unaVariante("Paleta")).toBe("una paleta");
  });

  it("da el nombre en singular o plural sin número", () => {
    expect(nombreVariante("Color")).toBe("color");
    expect(nombreVariante("Color", 2)).toBe("colores");
  });

  it("tiene texto para cada etiqueta permitida", () => {
    for (const etiqueta of ETIQUETAS_VARIANTE) {
      expect(verboElegir(etiqueta)).toMatch(/^Elegir [a-zñ]+$/);
      expect(tituloSelector(etiqueta)).toMatch(/^Elige (el|la) [a-zñ]+$/);
    }
  });
});

describe("etiquetaPorDefecto", () => {
  it("usa Tono en el maquillaje y Color en el resto", () => {
    expect(etiquetaPorDefecto("labios")).toBe("Tono");
    expect(etiquetaPorDefecto("rostro")).toBe("Tono");
    expect(etiquetaPorDefecto("ojos-y-cejas")).toBe("Tono");
    expect(etiquetaPorDefecto("bolsos-y-accesorios")).toBe("Color");
    expect(etiquetaPorDefecto("cabello-y-peinado")).toBe("Color");
  });

  it("usa Tono cuando no se sabe el departamento", () => {
    expect(etiquetaPorDefecto(null)).toBe("Tono");
  });

  it("reconoce el maquillaje aunque el catálogo aún no tenga departamentos", () => {
    // Con categorías planas la «raíz» es la propia categoría.
    expect(etiquetaPorDefecto("lip-gloss")).toBe("Tono");
    expect(etiquetaPorDefecto("sombras")).toBe("Tono");
    expect(etiquetaPorDefecto("cepillos")).toBe("Color");
  });
});

describe("resolverEtiqueta", () => {
  it("manda la del producto sobre todas", () => {
    expect(
      resolverEtiqueta({
        producto: "Aroma",
        categoria: "Paleta",
        departamento: "Color",
        slugDepartamento: "labios",
      })
    ).toBe("Aroma");
  });

  it("sin la del producto, usa la de la categoría", () => {
    expect(
      resolverEtiqueta({
        producto: null,
        categoria: "Paleta",
        departamento: "Color",
        slugDepartamento: "labios",
      })
    ).toBe("Paleta");
  });

  it("sin producto ni categoría, usa la del departamento", () => {
    expect(
      resolverEtiqueta({
        producto: null,
        categoria: null,
        departamento: "Diseño",
        slugDepartamento: "labios",
      })
    ).toBe("Diseño");
  });

  it("sin ninguna, cae al valor por defecto del departamento", () => {
    expect(
      resolverEtiqueta({
        producto: null,
        categoria: null,
        departamento: null,
        slugDepartamento: "bolsos-y-accesorios",
      })
    ).toBe("Color");
  });
});

describe("muestrasConfiables", () => {
  it("acepta colores válidos y bien distintos", () => {
    expect(muestrasConfiables(hex("#FF0000", "#00FF00"))).toBe(true);
    expect(muestrasConfiables(hex("#c00000"))).toBe(true);
  });

  it("rechaza el valor por defecto del formulario", () => {
    expect(muestrasConfiables(hex("#FF0000", "#e5308a"))).toBe(false);
    expect(muestrasConfiables(hex("#E5308A"))).toBe(false);
  });

  it("rechaza dos muestras que a la vista son el mismo color", () => {
    expect(muestrasConfiables(hex("#FF0000", "#FE0101"))).toBe(false);
  });

  it("pone el límite en una diferencia de color (ΔE76) de 10", () => {
    expect(muestrasConfiables(hex("#d8b49c", "#c9a086"))).toBe(false); // ΔE ≈ 7,5
    expect(muestrasConfiables(hex("#d8b49c", "#bf9677"))).toBe(true); // ΔE ≈ 12
  });

  it("rechaza lo que no es un color", () => {
    expect(muestrasConfiables(hex("rojo"))).toBe(false);
    expect(muestrasConfiables(hex("#FF0000", ""))).toBe(false);
  });

  it("no hay muestras confiables sin variantes", () => {
    expect(muestrasConfiables([])).toBe(false);
  });
});

describe("esNumeracionDeFoto", () => {
  it("reconoce los nombres «Tono N» y «Tono N …»", () => {
    expect(esNumeracionDeFoto(nombres("Tono 1", "Tono 2 modelo K"))).toBe(true);
    expect(esNumeracionDeFoto(nombres("tono 3", "Tono 12"))).toBe(true);
  });

  it("basta un nombre real para que no sea numeración", () => {
    expect(esNumeracionDeFoto(nombres("Rosado", "Tono 1"))).toBe(false);
    expect(esNumeracionDeFoto(nombres("Tonos neutros"))).toBe(false);
  });

  it("sin variantes no hay numeración", () => {
    expect(esNumeracionDeFoto([])).toBe(false);
  });
});
