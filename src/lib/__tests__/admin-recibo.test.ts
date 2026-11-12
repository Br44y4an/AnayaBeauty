// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CIERRE_POR_DEFECTO,
  PREFERENCIAS_POR_DEFECTO,
  cierreDe,
  datosDePago,
  encabezadoDocumento,
  filasDelTotal,
  destinatarioDePedido,
  fechaDeRecibo,
  fechaLarga,
  guardarPreferencias,
  hoyEnBogota,
  leerEntero,
  leerPreferencias,
  lineasDestinatario,
  nombreArchivo,
  numeroSugerido,
  queFalta,
  reciboListo,
  revisarLineaTexto,
  textoImprimible,
  totalesDeRecibo,
  validarLineaTexto,
  type Destinatario,
} from "@/lib/admin/recibo";

const VACIO: Destinatario = { nombre: "", documento: "", whatsapp: "", ciudad: "", direccion: "" };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("totalesDeRecibo", () => {
  it("suma las líneas de texto después del descuento", () => {
    const totales = totalesDeRecibo({
      subtotalCatalogo: 100000,
      descuentoCatalogo: 5000,
      lineasTexto: [{ id: "t1", descripcion: "Envío", cantidad: 2, precioUnitario: 6000 }],
    });

    expect(totales).toEqual({ subtotal: 112000, descuento: 5000, total: 107000 });
  });

  it("sin líneas de texto el total es el del catálogo", () => {
    expect(totalesDeRecibo({ subtotalCatalogo: 56700, descuentoCatalogo: 0, lineasTexto: [] })).toEqual({
      subtotal: 56700,
      descuento: 0,
      total: 56700,
    });
  });

  it("el descuento nunca se come un producto en texto ni deja el total en negativo", () => {
    const lineasTexto = [{ id: "t1", descripcion: "Envío", cantidad: 1, precioUnitario: 8000 }];

    expect(totalesDeRecibo({ subtotalCatalogo: 10000, descuentoCatalogo: 25000, lineasTexto })).toEqual({
      subtotal: 18000,
      descuento: 10000,
      total: 8000,
    });
    expect(totalesDeRecibo({ subtotalCatalogo: 10000, descuentoCatalogo: -300, lineasTexto: [] }).descuento).toBe(0);
    expect(totalesDeRecibo({ subtotalCatalogo: 10000, descuentoCatalogo: Number.NaN, lineasTexto: [] }).total).toBe(10000);
  });
});

describe("validarLineaTexto", () => {
  const buena = { descripcion: "Envío a Pereira", cantidad: 1, precioUnitario: 8000 };

  it("acepta una línea completa, también con precio 0", () => {
    expect(validarLineaTexto(buena)).toBeNull();
    expect(validarLineaTexto({ ...buena, precioUnitario: 0 })).toBeNull();
  });

  it("pide la descripción y la limita a 120 caracteres", () => {
    expect(validarLineaTexto({ ...buena, descripcion: "   " })).toBe("Escribe qué producto o servicio es.");
    expect(validarLineaTexto({ ...buena, descripcion: "a".repeat(120) })).toBeNull();
    expect(validarLineaTexto({ ...buena, descripcion: "a".repeat(121) })).toBe(
      "La descripción admite hasta 120 caracteres."
    );
  });

  it("la cantidad es un entero desde 1", () => {
    for (const cantidad of [0, -2, 1.5, Number.NaN]) {
      expect(validarLineaTexto({ ...buena, cantidad })).toBe("La cantidad debe ser un número entero desde 1.");
    }
  });

  it("el precio es un entero desde 0", () => {
    for (const precioUnitario of [-1, 99.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validarLineaTexto({ ...buena, precioUnitario })).toBe(
        "Escribe el precio en pesos, sin decimales. Si no se cobra, pon 0."
      );
    }
  });

  it("revisarLineaTexto dice en qué campo está el problema", () => {
    expect(revisarLineaTexto({ ...buena, descripcion: "" })?.campo).toBe("descripcion");
    expect(revisarLineaTexto({ ...buena, cantidad: 0 })?.campo).toBe("cantidad");
    expect(revisarLineaTexto({ ...buena, precioUnitario: -5 })?.campo).toBe("precioUnitario");
    expect(revisarLineaTexto(buena)).toBeNull();
  });
});

describe("leerEntero", () => {
  it("entiende los pesos como se escriben en Colombia", () => {
    expect(leerEntero("6000")).toBe(6000);
    expect(leerEntero(" $ 6.000 ")).toBe(6000);
    expect(leerEntero("1.250.000")).toBe(1250000);
    expect(leerEntero("0")).toBe(0);
  });

  it("no adivina: vacío, decimales o letras no son un número", () => {
    for (const texto of ["", "  ", "6,5", "6.5", "12a", "-3", "6.0000"]) {
      expect(leerEntero(texto)).toBeNaN();
    }
  });
});

describe("preferencias del recibo", () => {
  it("por defecto: «Recibo», sin nota y con los datos de pago", () => {
    expect(PREFERENCIAS_POR_DEFECTO).toEqual({ titulo: "Recibo", nota: "", mostrarPago: true });
    expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("guarda y lee en este navegador con la clave acordada", () => {
    const preferencias = { titulo: "Cuenta de cobro", nota: "Gracias.\nCambios en 5 días.", mostrarPago: false };
    guardarPreferencias(preferencias);

    expect(JSON.parse(localStorage.getItem("anaya-recibo-preferencias")!)).toEqual(preferencias);
    expect(leerPreferencias()).toEqual(preferencias);
  });

  it("si el almacenamiento lanza, lee los valores por defecto y guardar no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(() => guardarPreferencias({ titulo: "Cotización", nota: "", mostrarPago: true })).not.toThrow();
  });

  it("ignora lo guardado si está dañado y recorta lo que se pasa del límite", () => {
    localStorage.setItem("anaya-recibo-preferencias", "{no es json");
    expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);

    localStorage.setItem("anaya-recibo-preferencias", JSON.stringify({ titulo: 7, nota: null, mostrarPago: "si" }));
    expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);

    localStorage.setItem(
      "anaya-recibo-preferencias",
      JSON.stringify({ titulo: "T".repeat(60), nota: "n".repeat(500), mostrarPago: false })
    );
    expect(leerPreferencias()).toEqual({ titulo: "T".repeat(40), nota: "n".repeat(400), mostrarPago: false });
  });

  it("un título guardado en blanco vuelve a «Recibo»", () => {
    localStorage.setItem("anaya-recibo-preferencias", JSON.stringify({ titulo: "  ", nota: "Hola", mostrarPago: true }));
    expect(leerPreferencias()).toEqual({ titulo: "Recibo", nota: "Hola", mostrarPago: true });
  });
});

describe("destinatario", () => {
  it("sale de los datos del pedido, sin documento ni dirección", () => {
    expect(
      destinatarioDePedido({ clienteNombre: "Gloria Cárdenas", clienteWhatsapp: "3105551234", clienteCiudad: "Pereira" })
    ).toEqual({ nombre: "Gloria Cárdenas", documento: "", whatsapp: "3105551234", ciudad: "Pereira", direccion: "" });
  });

  it("un pedido viejo con datos nulos no deja «null» en el recibo", () => {
    const viejo = { clienteNombre: "Ana", clienteWhatsapp: null, clienteCiudad: undefined } as unknown as Parameters<
      typeof destinatarioDePedido
    >[0];
    expect(destinatarioDePedido(viejo)).toEqual({ ...VACIO, nombre: "Ana" });
  });

  it("el detalle solo trae los campos presentes", () => {
    expect(lineasDestinatario({ ...VACIO, nombre: "Ana" })).toEqual([]);
    expect(lineasDestinatario({ ...VACIO, nombre: "Ana", whatsapp: " 300 123 4567 " })).toEqual(["300 123 4567"]);
    expect(
      lineasDestinatario({
        nombre: "Distribuidora Luna SAS",
        documento: "NIT 900.123.456-7",
        whatsapp: "3001234567",
        ciudad: "Medellín",
        direccion: "Cra 43A # 1-50",
      })
    ).toEqual(["Documento: NIT 900.123.456-7", "Medellín · 3001234567", "Cra 43A # 1-50"]);
  });
});

describe("reciboListo y queFalta", () => {
  const conNombre = { ...VACIO, nombre: "Ana" };

  it("pide el nombre y al menos una línea", () => {
    expect(reciboListo({ destinatario: conNombre, lineas: 1 })).toBe(true);
    expect(reciboListo({ destinatario: { ...VACIO, nombre: "  " }, lineas: 3 })).toBe(false);
    expect(reciboListo({ destinatario: conNombre, lineas: 0 })).toBe(false);
  });

  it("explica qué falta", () => {
    expect(queFalta({ destinatario: conNombre, lineas: 2 })).toBeNull();
    expect(queFalta({ destinatario: VACIO, lineas: 2 })).toBe("Falta el nombre en «Dirigido a».");
    expect(queFalta({ destinatario: conNombre, lineas: 0 })).toBe("Falta agregar al menos un producto.");
    expect(queFalta({ destinatario: VACIO, lineas: 0 })).toBe(
      "Falta el nombre en «Dirigido a» y agregar al menos un producto."
    );
  });
});

describe("textoImprimible", () => {
  it("deja el español como está", () => {
    expect(textoImprimible("María Ñáñez · «Envío» ¿sí? 5 %")).toBe("María Ñáñez · «Envío» ¿sí? 5 %");
  });

  it("cambia lo que el teclado del celular pone solo y quita lo que el PDF no puede escribir", () => {
    expect(textoImprimible("“Gracias” — vuelve pronto… 😀💖")).toBe('"Gracias" - vuelve pronto...');
    expect(textoImprimible("Labial  rojo \u{1F484}  mate")).toBe("Labial rojo mate");
    expect(textoImprimible("it’s")).toBe("it's");
  });

  it("une las tildes sueltas y conserva los saltos de línea de la nota", () => {
    expect(textoImprimible("Medellín")).toBe("Medellín");
    expect(textoImprimible("  Línea uno  \r\n\n\n\nLínea dos ")).toBe("Línea uno\n\nLínea dos");
  });
});

describe("fecha y número", () => {
  it("hoy es el día de Bogotá, no el del servidor", () => {
    expect(hoyEnBogota(new Date("2026-11-11T03:30:00Z"))).toBe("2026-11-10");
    expect(hoyEnBogota(new Date("2026-11-11T15:00:00Z"))).toBe("2026-11-11");
  });

  it("la fecha del campo se imprime con ese mismo día", () => {
    expect(fechaLarga(fechaDeRecibo("2026-11-10"))).toBe("10 de noviembre de 2026");
    expect(fechaLarga(fechaDeRecibo("2026-01-01"))).toBe("01 de enero de 2026");
  });

  it("una fecha vacía o imposible cae en la de respaldo", () => {
    const respaldo = new Date("2026-11-11T15:00:00Z");
    expect(fechaDeRecibo("", respaldo)).toBe(respaldo);
    expect(fechaDeRecibo("2026-13-45", respaldo)).toBe(respaldo);
  });

  it("sugiere un número con la fecha y tres cifras", () => {
    expect(numeroSugerido("2026-11-10", () => 0)).toBe("REC-20261110-100");
    expect(numeroSugerido("2026-11-10", () => 0.9999)).toBe("REC-20261110-999");
  });

  it("el archivo se llama como el documento, sin caracteres raros", () => {
    expect(nombreArchivo("Recibo", "AB-0098")).toBe("recibo-AB-0098.pdf");
    expect(nombreArchivo("Cuenta de cobro", "N.º 12/2026")).toBe("cuenta-de-cobro-N-12-2026.pdf");
    expect(nombreArchivo("Cotización", "")).toBe("cotizacion.pdf");
    expect(nombreArchivo("  ", "  ")).toBe("recibo.pdf");
  });
});

describe("lo que comparten el PDF y la vista previa", () => {
  const base = { subtotal: 22500, descuento: 1125, porcentaje: 5, porMayor: false, total: 21375 };

  it("el encabezado une el título y el número", () => {
    expect(encabezadoDocumento("Cuenta de cobro", "AB-0098")).toBe("Cuenta de cobro AB-0098");
    expect(encabezadoDocumento("  ", "AB-0098")).toBe("Recibo AB-0098");
    expect(encabezadoDocumento("Cotización", " ")).toBe("Cotización");
  });

  it("el desglose muestra subtotal, descuento y total solo cuando hay descuento", () => {
    expect(filasDelTotal(base)).toEqual([
      { etiqueta: "Subtotal", valor: "$22.500", tipo: "normal" },
      { etiqueta: "Descuento 5 %", valor: "-$1.125", tipo: "ahorro" },
      { etiqueta: "Total", valor: "$21.375", tipo: "total" },
    ]);
    expect(filasDelTotal({ ...base, descuento: 0, porcentaje: 0, total: 22500 })).toEqual([
      { etiqueta: "Total", valor: "$22.500", tipo: "total" },
    ]);
    expect(filasDelTotal({ ...base, porcentaje: 0 }, "\u2212")[1]).toEqual({
      etiqueta: "Descuento",
      valor: "\u2212$1.125",
      tipo: "ahorro",
    });
    expect(filasDelTotal({ ...base, descuento: 0, porMayor: true }).map((f) => f.etiqueta)).toEqual([
      "Subtotal",
      "Precio por mayor",
      "Total",
    ]);
  });

  it("los datos de pago salen solo con la casilla y con un número", () => {
    const pago = { mostrarPago: true, pagoMetodo: "Nequi", pagoNumero: "3228813646", pagoTitular: "Anaya Beauty" };
    expect(datosDePago(pago)).toEqual({ cuenta: "Nequi 3228813646", titular: "a nombre de Anaya Beauty" });
    expect(datosDePago({ ...pago, mostrarPago: false })).toBeNull();
    expect(datosDePago({ ...pago, pagoNumero: "  " })).toBeNull();
    expect(datosDePago({ ...pago, pagoMetodo: null, pagoTitular: null })).toEqual({
      cuenta: "3228813646",
      titular: null,
    });
  });

  it("la nota reemplaza el cierre de siempre", () => {
    expect(cierreDe("  ")).toEqual({ tipo: "cierre", ...CIERRE_POR_DEFECTO });
    expect(cierreDe(" Gracias.\nVuelve pronto. ")).toEqual({ tipo: "nota", parrafos: ["Gracias.", "Vuelve pronto."] });
  });
});
