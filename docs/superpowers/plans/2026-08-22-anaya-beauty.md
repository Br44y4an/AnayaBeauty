# Anaya Beauty — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el catálogo digital de Anaya Beauty: las clientas exploran productos desde un QR, arman un carrito con precios por escalones de cantidad, y confirman el pedido con un código de 4 dígitos de un solo uso; la administradora gestiona todo desde un panel en tiempo real y recibe cada pedido por correo.

**Architecture:** Next.js 15 (App Router) sobre Supabase. Toda la lógica crítica — validación del código, verificación de stock y cálculo de precios — vive en una única función de PostgreSQL transaccional (`crear_pedido`), de modo que el navegador nunca decide precios ni puede provocar sobreventa. El motor de precios es una función pura de TypeScript, compartida entre la interfaz (para mostrar y sugerir) y las pruebas, con PostgreSQL replicando la misma regla como fuente de verdad.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Supabase (Postgres + Auth + Storage + Realtime), Zustand, Resend, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-22-anaya-beauty-catalogo-design.md`

## Global Constraints

- **Idioma de la interfaz:** español de Colombia. Todo texto visible para la clienta o la administradora va en español.
- **Nomenclatura:** tablas y columnas de PostgreSQL en `snake_case` español (`price_tiers`, `min_cantidad`). Tipos y funciones de TypeScript en `camelCase` español (`precioUnitario`). La capa de datos hace la traducción; ninguna otra capa ve `snake_case`.
- **Moneda:** pesos colombianos como enteros, sin decimales. Nunca usar `float` para dinero.
- **Formato de precios visibles:** `$27.000` (punto como separador de miles, sin decimales, símbolo pegado).
- **Contacto de la marca:** WhatsApp `+57 313 255 3660` (formato internacional para enlaces: `573132553660`).
- **Correo destino de pedidos:** `anayabeauty54@gmail.com`.
- **Remitente de correo:** `onboarding@resend.dev` (el plan gratuito de Resend solo permite enviar a la dirección con la que se registró la cuenta).
- **Colores de marca:** fucsia `#E5308A`, lila `#A97FD0`, rosa nube `#FDF2F7`, blanco `#FFFFFF`, carbón `#3D2B36`.
- **Tipografías:** `Playfair Display` para títulos, `Nunito` para el resto.
- **Mobile-first:** todo se diseña primero para pantallas de 360 px de ancho. Áreas táctiles mínimas de 44 px.
- **Accesibilidad:** contraste mínimo AA. Respetar `prefers-reduced-motion` en toda animación.
- **Números de pedido:** formato `AB-0001`, generado por una secuencia de PostgreSQL.
- **Nunca confiar en el cliente:** el navegador solo envía pares de `productId` y `cantidad`. Precios, nombres y totales se calculan siempre en el servidor.

---

## Estructura de archivos

```
supabase/
  schema.sql                  Tablas, índices, secuencia, datos iniciales
  policies.sql                Row Level Security de todas las tablas
  functions.sql               crear_pedido, cancelar_pedido, limpiar_codigos
  tests.sql                   Verificaciones ejecutables en el editor SQL

src/lib/
  pricing.ts                  Motor de precios (función pura, sin dependencias)
  types.ts                    Tipos de dominio compartidos
  format.ts                   Formato de moneda y enlaces de WhatsApp
  cart.ts                     Estado del carrito (Zustand + localStorage)
  supabase/client.ts          Cliente de navegador (clave anónima)
  supabase/server.ts          Cliente de servidor con cookies
  supabase/admin.ts           Cliente con clave de servicio (solo servidor)
  data/catalog.ts             Consultas del catálogo público
  data/orders.ts              Consultas de pedidos (panel)
  data/codes.ts               Consultas de códigos (panel)
  email/send-order.ts         Envío por Resend
  email/order-template.ts     Plantilla HTML del correo

src/app/
  layout.tsx                  Tipografías, tema, metadatos
  page.tsx                    Catálogo
  producto/[referencia]/page.tsx
  carrito/page.tsx
  confirmar/page.tsx
  confirmar/actions.ts        Server action de confirmación
  c/[codigo]/route.ts         Link mágico
  pedido/[numero]/page.tsx    Pantalla de éxito
  admin/…                     Panel completo

src/components/
  catalogo/                   Grilla, tarjeta, buscador, filtros
  producto/                   Galería, tabla de escalones, selector
  carrito/                    Botón flotante, líneas, resumen
  ui/                         Botón, campo, insignia, hoja modal
  admin/                      Tabla de pedidos, formularios
```

Cada archivo tiene una sola responsabilidad. `pricing.ts` no importa nada; es el núcleo probable del sistema.

---

## Task 1: Andamiaje del proyecto y tema de marca

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `.env.example`
- Test: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: proyecto Next.js ejecutable con `npm run dev`, Vitest funcionando con `npm test`, y variables CSS de marca disponibles globalmente (`--fucsia`, `--lila`, `--rosa-nube`, `--petalo`, `--carbon`).

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --yes
```

Si el directorio no está vacío, `create-next-app` se queja; en ese caso, responde que sí a sobrescribir — `docs/` y `.git/` no se tocan.

- [ ] **Step 2: Instalar dependencias del proyecto**

```bash
npm install @supabase/supabase-js @supabase/ssr zustand resend qrcode
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/qrcode
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Crear `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Añadir a `package.json` en `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir una prueba de humo que falle**

Crear `src/lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { saludo } from "@/lib/smoke";

describe("andamiaje", () => {
  it("resuelve el alias @ y ejecuta TypeScript", () => {
    expect(saludo()).toBe("Anaya Beauty");
  });
});
```

- [ ] **Step 5: Ejecutar la prueba y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/smoke".

- [ ] **Step 6: Crear el módulo mínimo**

Crear `src/lib/smoke.ts`:

```ts
export function saludo(): string {
  return "Anaya Beauty";
}
```

- [ ] **Step 7: Ejecutar la prueba y verificar que pasa**

Run: `npm test`
Expected: PASS, 1 prueba.

- [ ] **Step 8: Definir el tema de marca**

Reemplazar el contenido de `src/app/globals.css` por:

```css
@import "tailwindcss";

@theme {
  --color-fucsia: #e5308a;
  --color-fucsia-suave: #f8a8cc;
  --color-lila: #a97fd0;
  --color-lila-suave: #ddc9ee;
  --color-rosa-nube: #fdf2f7;
  --color-petalo: #ffffff;
  --color-carbon: #3d2b36;
  --color-carbon-suave: #7a6470;

  --font-display: var(--fuente-playfair), Georgia, serif;
  --font-sans: var(--fuente-nunito), system-ui, sans-serif;

  --radius-suave: 1rem;
  --radius-tarjeta: 1.5rem;
  --radius-pastilla: 9999px;

  --shadow-petalo: 0 4px 20px -4px rgba(229, 48, 138, 0.18);
  --shadow-flotante: 0 8px 32px -8px rgba(229, 48, 138, 0.28);
}

body {
  background-color: var(--color-rosa-nube);
  color: var(--color-carbon);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 9: Cargar las tipografías en el layout**

Reemplazar `src/app/layout.tsx` por:

```tsx
import type { Metadata } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--fuente-playfair",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--fuente-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anaya Beauty — Belleza que te define",
  description: "Catálogo digital de maquillaje. Encuentra tus mejores productos y excelentes valores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${playfair.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Crear el archivo de variables de entorno de ejemplo**

Crear `.env.example`:

```
NEXT_PUBLIC_SITE_URL=https://anayabeauty.vercel.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CORREO_DESTINO=anayabeauty54@gmail.com
SAL_HASH_IP=
```

- [ ] **Step 11: Verificar que el sitio arranca**

Run: `npm run dev`
Expected: el servidor levanta en `http://localhost:3000` sin errores de compilación. Detener con Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: andamiaje Next.js con tema de marca y Vitest"
```

---

## Task 2: Motor de precios por escalones

Esta es la pieza más importante del sistema y no depende de nada. Se construye entera con pruebas primero.

**Files:**
- Create: `src/lib/pricing.ts`
- Test: `src/lib/__tests__/pricing.test.ts`
- Delete: `src/lib/smoke.ts`, `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Escalon = { minCantidad: number; precioUnitario: number }`
  - `precioUnitarioPara(escalones: Escalon[], cantidad: number): number`
  - `subtotalPara(escalones: Escalon[], cantidad: number): number`
  - `precioDesde(escalones: Escalon[]): number`
  - `type Upsell = { unidadesFaltantes: number; nuevaCantidad: number; nuevoPrecioUnitario: number; ahorro: number }`
  - `sugerenciaUpsell(escalones: Escalon[], cantidad: number): Upsell | null`

- [ ] **Step 1: Escribir las pruebas del motor de precios**

Crear `src/lib/__tests__/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  precioUnitarioPara,
  subtotalPara,
  precioDesde,
  sugerenciaUpsell,
  type Escalon,
} from "@/lib/pricing";

// El ejemplo real del negocio: 1 a $10.000, 3 a $9.000, 6 a $8.000
const labial: Escalon[] = [
  { minCantidad: 1, precioUnitario: 10000 },
  { minCantidad: 3, precioUnitario: 9000 },
  { minCantidad: 6, precioUnitario: 8000 },
];

// Escalones desordenados a propósito: el motor no puede asumir orden
const desordenado: Escalon[] = [
  { minCantidad: 6, precioUnitario: 8000 },
  { minCantidad: 1, precioUnitario: 10000 },
  { minCantidad: 3, precioUnitario: 9000 },
];

const unicoEscalon: Escalon[] = [{ minCantidad: 1, precioUnitario: 12000 }];

describe("precioUnitarioPara", () => {
  it("aplica el primer escalón para 1 y 2 unidades", () => {
    expect(precioUnitarioPara(labial, 1)).toBe(10000);
    expect(precioUnitarioPara(labial, 2)).toBe(10000);
  });

  it("aplica el segundo escalón desde 3 y hasta 5 unidades", () => {
    expect(precioUnitarioPara(labial, 3)).toBe(9000);
    expect(precioUnitarioPara(labial, 4)).toBe(9000);
    expect(precioUnitarioPara(labial, 5)).toBe(9000);
  });

  it("aplica el tercer escalón desde 6 unidades en adelante", () => {
    expect(precioUnitarioPara(labial, 6)).toBe(8000);
    expect(precioUnitarioPara(labial, 7)).toBe(8000);
    expect(precioUnitarioPara(labial, 50)).toBe(8000);
  });

  it("no depende del orden en que vengan los escalones", () => {
    expect(precioUnitarioPara(desordenado, 4)).toBe(9000);
    expect(precioUnitarioPara(desordenado, 6)).toBe(8000);
  });

  it("usa el escalón más bajo si la cantidad queda por debajo del mínimo", () => {
    const sinEscalonDeUno: Escalon[] = [{ minCantidad: 3, precioUnitario: 9000 }];
    expect(precioUnitarioPara(sinEscalonDeUno, 1)).toBe(9000);
  });

  it("lanza error si no hay escalones", () => {
    expect(() => precioUnitarioPara([], 1)).toThrow("sin escalones");
  });

  it("lanza error si la cantidad no es un entero positivo", () => {
    expect(() => precioUnitarioPara(labial, 0)).toThrow("cantidad");
    expect(() => precioUnitarioPara(labial, -2)).toThrow("cantidad");
    expect(() => precioUnitarioPara(labial, 1.5)).toThrow("cantidad");
  });
});

describe("subtotalPara", () => {
  it("reproduce la tabla completa del negocio", () => {
    expect(subtotalPara(labial, 1)).toBe(10000);
    expect(subtotalPara(labial, 2)).toBe(20000);
    expect(subtotalPara(labial, 3)).toBe(27000);
    expect(subtotalPara(labial, 4)).toBe(36000);
    expect(subtotalPara(labial, 5)).toBe(45000);
    expect(subtotalPara(labial, 6)).toBe(48000);
    expect(subtotalPara(labial, 7)).toBe(56000);
  });

  it("devuelve siempre un entero", () => {
    expect(Number.isInteger(subtotalPara(labial, 7))).toBe(true);
  });
});

describe("precioDesde", () => {
  it("devuelve el precio unitario más bajo disponible", () => {
    expect(precioDesde(labial)).toBe(8000);
    expect(precioDesde(unicoEscalon)).toBe(12000);
  });
});

describe("sugerenciaUpsell", () => {
  it("con 2 unidades sugiere llegar a 3 y calcula el ahorro real", () => {
    // A precio actual, 3 unidades costarían 30.000; con el escalón cuestan 27.000
    expect(sugerenciaUpsell(labial, 2)).toEqual({
      unidadesFaltantes: 1,
      nuevaCantidad: 3,
      nuevoPrecioUnitario: 9000,
      ahorro: 3000,
    });
  });

  it("con 5 unidades sugiere llegar a 6", () => {
    // A precio actual, 6 unidades costarían 54.000; con el escalón cuestan 48.000
    expect(sugerenciaUpsell(labial, 5)).toEqual({
      unidadesFaltantes: 1,
      nuevaCantidad: 6,
      nuevoPrecioUnitario: 8000,
      ahorro: 6000,
    });
  });

  it("con 1 unidad sugiere el siguiente escalón, no el último", () => {
    const sugerencia = sugerenciaUpsell(labial, 1);
    expect(sugerencia?.nuevaCantidad).toBe(3);
    expect(sugerencia?.unidadesFaltantes).toBe(2);
  });

  it("no sugiere nada cuando ya está en el escalón más alto", () => {
    expect(sugerenciaUpsell(labial, 6)).toBeNull();
    expect(sugerenciaUpsell(labial, 20)).toBeNull();
  });

  it("no sugiere nada cuando el producto tiene un solo escalón", () => {
    expect(sugerenciaUpsell(unicoEscalon, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas y verificar que fallan**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/pricing".

- [ ] **Step 3: Implementar el motor de precios**

Crear `src/lib/pricing.ts`:

```ts
/**
 * Motor de precios por escalones de cantidad.
 *
 * Regla del negocio: se toma el escalón más alto cuyo mínimo no supere la
 * cantidad pedida, y su precio unitario se multiplica por la cantidad.
 * Ejemplo con escalones 1→$10.000, 3→$9.000, 6→$8.000:
 * 4 unidades se cobran a $9.000 cada una, es decir $36.000.
 *
 * Este módulo no importa nada a propósito: es la pieza más probada del
 * sistema y debe poder ejecutarse en cualquier contexto.
 */

export type Escalon = {
  minCantidad: number;
  precioUnitario: number;
};

export type Upsell = {
  unidadesFaltantes: number;
  nuevaCantidad: number;
  nuevoPrecioUnitario: number;
  ahorro: number;
};

function ordenarAscendente(escalones: Escalon[]): Escalon[] {
  return [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);
}

function validar(escalones: Escalon[], cantidad: number): void {
  if (escalones.length === 0) {
    throw new Error("Producto sin escalones de precio configurados");
  }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error(`cantidad inválida: ${cantidad}`);
  }
}

export function precioUnitarioPara(escalones: Escalon[], cantidad: number): number {
  validar(escalones, cantidad);
  const ordenados = ordenarAscendente(escalones);

  let aplicable = ordenados[0];
  for (const escalon of ordenados) {
    if (escalon.minCantidad <= cantidad) {
      aplicable = escalon;
    }
  }
  return aplicable.precioUnitario;
}

export function subtotalPara(escalones: Escalon[], cantidad: number): number {
  return precioUnitarioPara(escalones, cantidad) * cantidad;
}

export function precioDesde(escalones: Escalon[]): number {
  if (escalones.length === 0) {
    throw new Error("Producto sin escalones de precio configurados");
  }
  return Math.min(...escalones.map((e) => e.precioUnitario));
}

export function sugerenciaUpsell(escalones: Escalon[], cantidad: number): Upsell | null {
  validar(escalones, cantidad);
  const ordenados = ordenarAscendente(escalones);

  const siguiente = ordenados.find((e) => e.minCantidad > cantidad);
  if (!siguiente) return null;

  const precioActual = precioUnitarioPara(escalones, cantidad);
  const nuevaCantidad = siguiente.minCantidad;
  const nuevoPrecioUnitario = siguiente.precioUnitario;

  // Cuánto se ahorra por comprar esa cantidad con el escalón nuevo
  // en vez de comprarla al precio que está pagando ahora.
  const ahorro = nuevaCantidad * precioActual - nuevaCantidad * nuevoPrecioUnitario;

  return {
    unidadesFaltantes: nuevaCantidad - cantidad,
    nuevaCantidad,
    nuevoPrecioUnitario,
    ahorro,
  };
}
```

- [ ] **Step 4: Ejecutar las pruebas y verificar que pasan**

Run: `npm test`
Expected: PASS, todas las pruebas de `pricing.test.ts` en verde.

- [ ] **Step 5: Eliminar los archivos de humo**

```bash
rm src/lib/smoke.ts src/lib/__tests__/smoke.test.ts
npm test
```

Expected: PASS, solo quedan las pruebas de precios.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: motor de precios por escalones con pruebas completas"
```

---

## Task 3: Utilidades de formato y tipos de dominio

**Files:**
- Create: `src/lib/format.ts`, `src/lib/types.ts`
- Test: `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `Escalon` de `@/lib/pricing`
- Produces:
  - `pesos(valor: number): string` → `"$27.000"`
  - `enlaceWhatsApp(mensaje: string): string`
  - `WHATSAPP_NEGOCIO: string` = `"573132553660"`
  - `type Producto`, `type Categoria`, `type LineaCarrito`, `type EstadoPedido`, `type Pedido`, `type LineaPedido`

- [ ] **Step 1: Escribir las pruebas de formato**

Crear `src/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pesos, enlaceWhatsApp, WHATSAPP_NEGOCIO } from "@/lib/format";

describe("pesos", () => {
  it("formatea con punto de miles y sin decimales", () => {
    expect(pesos(27000)).toBe("$27.000");
    expect(pesos(8000)).toBe("$8.000");
    expect(pesos(1250000)).toBe("$1.250.000");
  });

  it("maneja el cero", () => {
    expect(pesos(0)).toBe("$0");
  });

  it("redondea valores no enteros en vez de mostrar decimales", () => {
    expect(pesos(9999.6)).toBe("$10.000");
  });
});

describe("enlaceWhatsApp", () => {
  it("apunta al número del negocio con el mensaje codificado", () => {
    const url = enlaceWhatsApp("Hola, quiero mi código");
    expect(url).toBe(`https://wa.me/${WHATSAPP_NEGOCIO}?text=Hola%2C%20quiero%20mi%20c%C3%B3digo`);
  });

  it("usa el número del negocio en formato internacional sin signos", () => {
    expect(WHATSAPP_NEGOCIO).toBe("573132553660");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/format".

- [ ] **Step 3: Implementar formato**

Crear `src/lib/format.ts`:

```ts
export const WHATSAPP_NEGOCIO = "573132553660";

const formateador = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

/** Formatea un valor en pesos colombianos: 27000 → "$27.000" */
export function pesos(valor: number): string {
  return `$${formateador.format(Math.round(valor))}`;
}

/** Enlace directo al WhatsApp del negocio con un mensaje preescrito. */
export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(mensaje)}`;
}
```

Nota: `Intl.NumberFormat` con la configuración regional `es-CO` usa el punto como
separador de miles. Si el entorno de pruebas no trae datos ICU completos, la
prueba lo detectará de inmediato.

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Definir los tipos de dominio**

Crear `src/lib/types.ts`:

```ts
import type { Escalon } from "@/lib/pricing";

export type Categoria = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  categoriaPadreId: string | null;
};

export type Producto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  imagenPrincipal: string | null;
  galeria: string[];
  stock: number;
  activo: boolean;
  escalones: Escalon[];
};

/** Lo que se guarda en el navegador. Nunca incluye precios. */
export type LineaCarrito = {
  productoId: string;
  cantidad: number;
};

export type EstadoPedido = "nuevo" | "pagado" | "enviado" | "cancelado";

export type LineaPedido = {
  id: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precioUnitarioAplicado: number;
  subtotal: number;
};

export type Pedido = {
  id: string;
  numeroPedido: string;
  clienteNombre: string;
  clienteWhatsapp: string;
  clienteCiudad: string;
  total: number;
  estado: EstadoPedido;
  notasAdmin: string | null;
  codigoUsado: string | null;
  creadoEn: string;
  lineas: LineaPedido[];
};

export type EstadoCodigo = "disponible" | "usado" | "anulado";

export type Codigo = {
  id: string;
  code: string;
  estado: EstadoCodigo;
  venceEn: string;
  creadoEn: string;
  usadoEn: string | null;
  numeroPedido: string | null;
  nota: string | null;
};
```

`LineaCarrito` deliberadamente no guarda precios: es la garantía estructural de
que el navegador no puede proponer un precio.

- [ ] **Step 6: Verificar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: formato de moneda, enlaces de WhatsApp y tipos de dominio"
```

---

## Task 4: Esquema de base de datos

Todo el SQL vive en archivos versionados. El propietario los pega en el editor SQL de Supabase, en orden. Ese es el mecanismo de despliegue de base de datos del proyecto: sin migraciones automáticas, sin Docker, sin dependencias extra.

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Consumes: nada
- Produces: tablas `categories`, `products`, `price_tiers`, `access_codes`, `orders`, `order_items`, `store_settings`, `code_attempts`; tipos enum `estado_codigo` y `estado_pedido`; secuencia `seq_numero_pedido`.

- [ ] **Step 1: Escribir el esquema completo**

Crear `supabase/schema.sql`:

```sql
-- =====================================================================
-- Anaya Beauty — Esquema de base de datos
-- Ejecutar PRIMERO, en el editor SQL de Supabase.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Numeración consecutiva de pedidos: AB-0001, AB-0002, ...
create sequence if not exists seq_numero_pedido start 1;

-- ---------------------------------------------------------------------
-- Categorías (admiten subcategorías vía categoria_padre_id)
-- ---------------------------------------------------------------------
create table if not exists categories (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  slug               text not null unique,
  orden              int  not null default 0,
  categoria_padre_id uuid references categories(id) on delete set null,
  activo             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists categories_padre_idx on categories (categoria_padre_id);

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  referencia        text not null unique,
  nombre            text not null,
  descripcion       text,
  category_id       uuid references categories(id) on delete set null,
  imagen_principal  text,
  galeria           text[] not null default '{}',
  stock             int  not null default 0 check (stock >= 0),
  activo            boolean not null default true,
  orden             int  not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_categoria_idx on products (category_id);
create index if not exists products_activo_idx    on products (activo);
create index if not exists products_nombre_trgm   on products using gin (nombre gin_trgm_ops);
create index if not exists products_ref_trgm      on products using gin (referencia gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Escalones de precio por cantidad
-- Ejemplo: (1, 10000), (3, 9000), (6, 8000)
-- ---------------------------------------------------------------------
create table if not exists price_tiers (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  min_cantidad     int  not null check (min_cantidad >= 1),
  precio_unitario  int  not null check (precio_unitario > 0),
  unique (product_id, min_cantidad)
);
create index if not exists price_tiers_producto_idx on price_tiers (product_id, min_cantidad desc);

-- ---------------------------------------------------------------------
-- Códigos de acceso de 4 dígitos
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_codigo as enum ('disponible', 'usado', 'anulado');
exception when duplicate_object then null; end $$;

create table if not exists access_codes (
  id          uuid primary key default gen_random_uuid(),
  code        char(4) not null check (code ~ '^[0-9]{4}$'),
  estado      estado_codigo not null default 'disponible',
  creado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  vence_en    timestamptz not null,
  usado_en    timestamptz,
  order_id    uuid,
  nota        text
);

-- Solo puede haber UN código con el mismo número entre los disponibles.
-- Los usados y anulados quedan como historial y liberan el número.
create unique index if not exists access_codes_disponible_unico
  on access_codes (code) where estado = 'disponible';
create index if not exists access_codes_estado_idx on access_codes (estado, created_at desc);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_pedido as enum ('nuevo', 'pagado', 'enviado', 'cancelado');
exception when duplicate_object then null; end $$;

create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  numero_pedido     text not null unique
                      default 'AB-' || lpad(nextval('seq_numero_pedido')::text, 4, '0'),
  code_id           uuid references access_codes(id) on delete set null,
  cliente_nombre    text not null,
  cliente_whatsapp  text not null,
  cliente_ciudad    text not null,
  total             int  not null default 0,
  estado            estado_pedido not null default 'nuevo',
  notas_admin       text,
  -- Bandera de idempotencia: evita devolver el stock dos veces
  stock_devuelto    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists orders_estado_idx on orders (estado, created_at desc);
create index if not exists orders_fecha_idx  on orders (created_at desc);

-- La referencia circular se agrega después de crear ambas tablas
do $$ begin
  alter table access_codes
    add constraint access_codes_order_fk
    foreign key (order_id) references orders(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Líneas del pedido, con datos congelados al momento de la compra
-- ---------------------------------------------------------------------
create table if not exists order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id) on delete cascade,
  product_id                uuid references products(id) on delete set null,
  referencia_snapshot       text not null,
  nombre_snapshot           text not null,
  cantidad                  int  not null check (cantidad > 0),
  precio_unitario_aplicado  int  not null,
  subtotal                  int  not null
);
create index if not exists order_items_pedido_idx on order_items (order_id);

-- ---------------------------------------------------------------------
-- Configuración editable desde el panel
-- ---------------------------------------------------------------------
create table if not exists store_settings (
  clave           text primary key,
  valor           text not null,
  publico         boolean not null default false,
  actualizado_en  timestamptz not null default now()
);

insert into store_settings (clave, valor, publico) values
  ('pago_metodo',            'Nequi',                                        true),
  ('pago_titular',           'Anaya Beauty',                                 true),
  ('pago_numero',            '3132553660',                                   true),
  ('whatsapp_negocio',       '573132553660',                                 true),
  ('mensaje_exito',          '¡Gracias por tu compra, princesa! ✨',          true),
  ('horas_vigencia_codigo',  '24',                                           false)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- Intentos fallidos de canje (para el límite de intentos)
-- Se guarda un hash con sal de la IP, nunca la IP en claro.
-- ---------------------------------------------------------------------
create table if not exists code_attempts (
  id          bigserial primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists code_attempts_idx on code_attempts (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- Mantener updated_at al día
-- ---------------------------------------------------------------------
create or replace function tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function tocar_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function tocar_updated_at();
```

- [ ] **Step 2: Documentar el orden de ejecución**

Crear `supabase/README.md`:

```markdown
# Base de datos de Anaya Beauty

Ejecuta estos archivos en el editor SQL de Supabase, **en este orden**:

1. `schema.sql` — tablas, índices y configuración inicial
2. `policies.sql` — reglas de seguridad (Row Level Security)
3. `functions.sql` — funciones de pedidos y códigos
4. `tests.sql` — verificación; debe terminar con "TODAS LAS PRUEBAS PASARON"

Los cuatro archivos son idempotentes: puedes volver a ejecutarlos sin dañar
los datos existentes.

## Storage

Crea un bucket **público** llamado `productos` para las imágenes.
```

- [ ] **Step 3: Ejecutar el esquema en Supabase**

Pegar el contenido de `supabase/schema.sql` en el editor SQL del proyecto de Supabase y ejecutarlo.
Expected: "Success. No rows returned".

- [ ] **Step 4: Verificar que las tablas existen**

Ejecutar en el editor SQL:

```sql
select table_name from information_schema.tables
 where table_schema = 'public' order by table_name;
```

Expected: aparecen `access_codes`, `categories`, `code_attempts`, `order_items`, `orders`, `price_tiers`, `products`, `store_settings`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): esquema de base de datos"
```

---

## Task 5: Seguridad a nivel de fila

Sin esta tarea, cualquiera con la clave anónima —que es pública por diseño— podría leer la tabla de códigos y sacar uno gratis. Es la tarea de seguridad crítica del proyecto.

**Files:**
- Create: `supabase/policies.sql`

**Interfaces:**
- Consumes: tablas de Task 4
- Produces: RLS activo en las ocho tablas, con lectura pública solo del catálogo y de la configuración marcada como pública.

- [ ] **Step 1: Escribir las políticas**

Crear `supabase/policies.sql`:

```sql
-- =====================================================================
-- Anaya Beauty — Row Level Security
-- Ejecutar SEGUNDO, después de schema.sql
-- =====================================================================

alter table categories     enable row level security;
alter table products       enable row level security;
alter table price_tiers    enable row level security;
alter table access_codes   enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table store_settings enable row level security;
alter table code_attempts  enable row level security;

-- ---------------------------------------------------------------------
-- CATÁLOGO: lectura pública de lo que está activo
-- ---------------------------------------------------------------------
drop policy if exists categories_lectura_publica on categories;
create policy categories_lectura_publica on categories
  for select to anon, authenticated using (activo = true);

drop policy if exists products_lectura_publica on products;
create policy products_lectura_publica on products
  for select to anon, authenticated using (activo = true);

-- Los escalones son visibles solo si su producto lo es
drop policy if exists price_tiers_lectura_publica on price_tiers;
create policy price_tiers_lectura_publica on price_tiers
  for select to anon, authenticated using (
    exists (select 1 from products p where p.id = price_tiers.product_id and p.activo = true)
  );

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN: solo las claves marcadas como públicas
-- ---------------------------------------------------------------------
drop policy if exists settings_lectura_publica on store_settings;
create policy settings_lectura_publica on store_settings
  for select to anon, authenticated using (publico = true);

-- ---------------------------------------------------------------------
-- ADMINISTRACIÓN: cualquier usuario autenticado gestiona todo
-- (solo existen dos usuarios, creados a mano; no hay registro abierto)
-- ---------------------------------------------------------------------
drop policy if exists categories_admin on categories;
create policy categories_admin on categories
  for all to authenticated using (true) with check (true);

drop policy if exists products_admin on products;
create policy products_admin on products
  for all to authenticated using (true) with check (true);

drop policy if exists price_tiers_admin on price_tiers;
create policy price_tiers_admin on price_tiers
  for all to authenticated using (true) with check (true);

drop policy if exists settings_admin on store_settings;
create policy settings_admin on store_settings
  for all to authenticated using (true) with check (true);

drop policy if exists codes_admin on access_codes;
create policy codes_admin on access_codes
  for all to authenticated using (true) with check (true);

drop policy if exists orders_admin on orders;
create policy orders_admin on orders
  for all to authenticated using (true) with check (true);

drop policy if exists order_items_admin on order_items;
create policy order_items_admin on order_items
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- SIN POLÍTICA PARA anon EN:
--   access_codes  → si los códigos fueran legibles, cualquiera tendría uno gratis
--   orders        → los datos personales de las clientas no son públicos
--   order_items
--   code_attempts
-- El acceso público a estas tablas ocurre únicamente a través de las
-- funciones SECURITY DEFINER definidas en functions.sql.
-- ---------------------------------------------------------------------
```

- [ ] **Step 2: Ejecutar las políticas en Supabase**

Pegar `supabase/policies.sql` en el editor SQL y ejecutar.
Expected: "Success. No rows returned".

- [ ] **Step 3: Verificar que los códigos NO son legibles públicamente**

En el editor SQL, simular el rol anónimo:

```sql
set local role anon;
select count(*) from access_codes;
reset role;
```

Expected: devuelve `0` aunque existan códigos, o bien un error de permisos. Si devuelve un número mayor que cero, **la seguridad está rota** y no se debe continuar.

- [ ] **Step 4: Verificar que el catálogo SÍ es legible públicamente**

```sql
set local role anon;
select count(*) from products;
reset role;
```

Expected: se ejecuta sin error de permisos.

- [ ] **Step 5: Commit**

```bash
git add supabase/policies.sql
git commit -m "feat(db): row level security, códigos y pedidos no legibles públicamente"
```

---

## Task 6: Funciones de pedidos y códigos

El corazón transaccional del sistema. Aquí es donde se garantiza que nunca se venda dos veces el último producto y que el navegador no pueda inventar precios.

**Files:**
- Create: `supabase/functions.sql`
- Create: `supabase/tests.sql`

**Interfaces:**
- Consumes: tablas de Task 4, políticas de Task 5
- Produces:
  - `precio_unitario_para(p_product_id uuid, p_cantidad int) → int`
  - `crear_pedido(p_codigo text, p_nombre text, p_whatsapp text, p_ciudad text, p_items jsonb, p_ip_hash text) → jsonb` con forma `{"order_id": uuid, "numero_pedido": text, "total": int}`
  - `cancelar_pedido(p_order_id uuid) → void`
  - `generar_codigo(p_nota text) → jsonb` con forma `{"code": text, "vence_en": timestamptz}`
  - Formato de errores: `CODIGO_INVALIDO`, `CODIGO_VENCIDO`, `DEMASIADOS_INTENTOS`, `CARRITO_VACIO`, `CANTIDAD_INVALIDA`, `PRODUCTO_NO_DISPONIBLE`, `SIN_PRECIO`, y `SIN_STOCK|<nombre>|<disponible>`

- [ ] **Step 1: Escribir las funciones**

Crear `supabase/functions.sql`:

```sql
-- =====================================================================
-- Anaya Beauty — Funciones de negocio
-- Ejecutar TERCERO, después de policies.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Motor de precios, versión PostgreSQL.
-- Debe coincidir exactamente con src/lib/pricing.ts.
-- Toma el escalón más alto cuyo mínimo no supere la cantidad; si la
-- cantidad queda por debajo de todos, usa el escalón más bajo.
-- ---------------------------------------------------------------------
create or replace function precio_unitario_para(p_product_id uuid, p_cantidad int)
returns int
language sql
stable
as $$
  select coalesce(
    (select precio_unitario from price_tiers
      where product_id = p_product_id and min_cantidad <= p_cantidad
      order by min_cantidad desc limit 1),
    (select precio_unitario from price_tiers
      where product_id = p_product_id
      order by min_cantidad asc limit 1)
  );
$$;

-- ---------------------------------------------------------------------
-- crear_pedido: valida el código, verifica stock, recalcula precios,
-- descuenta inventario, guarda el pedido y quema el código.
-- Todo o nada.
-- ---------------------------------------------------------------------
create or replace function crear_pedido(
  p_codigo   text,
  p_nombre   text,
  p_whatsapp text,
  p_ciudad   text,
  p_items    jsonb,
  p_ip_hash  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     access_codes%rowtype;
  v_producto products%rowtype;
  v_intentos int;
  v_item     jsonb;
  v_cantidad int;
  v_precio   int;
  v_subtotal int;
  v_total    int := 0;
  v_order_id uuid;
  v_numero   text;
begin
  -- Límite de intentos: 5 fallos por dispositivo cada 10 minutos.
  select count(*) into v_intentos
    from code_attempts
   where ip_hash = p_ip_hash
     and created_at > now() - interval '10 minutes';

  if v_intentos >= 5 then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_whatsapp), '') = ''
     or coalesce(trim(p_ciudad), '') = '' then
    raise exception 'DATOS_INCOMPLETOS';
  end if;

  -- Bloquea el código: si dos clientas envían el mismo código a la vez,
  -- la segunda espera aquí y luego lo encuentra ya usado.
  select * into v_code
    from access_codes
   where code = p_codigo and estado = 'disponible'
   for update;

  if not found then
    insert into code_attempts (ip_hash) values (p_ip_hash);
    raise exception 'CODIGO_INVALIDO';
  end if;

  if v_code.vence_en <= now() then
    insert into code_attempts (ip_hash) values (p_ip_hash);
    raise exception 'CODIGO_VENCIDO';
  end if;

  insert into orders (code_id, cliente_nombre, cliente_whatsapp, cliente_ciudad)
  values (v_code.id, trim(p_nombre), trim(p_whatsapp), trim(p_ciudad))
  returning id, numero_pedido into v_order_id, v_numero;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::int;

    if v_cantidad is null or v_cantidad < 1 then
      raise exception 'CANTIDAD_INVALIDA';
    end if;

    select * into v_producto
      from products
     where id = (v_item->>'producto_id')::uuid
     for update;

    if not found or not v_producto.activo then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;

    if v_producto.stock < v_cantidad then
      raise exception 'SIN_STOCK|%|%', v_producto.nombre, v_producto.stock;
    end if;

    -- El precio SIEMPRE sale de la base de datos, nunca del navegador.
    v_precio := precio_unitario_para(v_producto.id, v_cantidad);
    if v_precio is null then
      raise exception 'SIN_PRECIO';
    end if;

    v_subtotal := v_precio * v_cantidad;
    v_total    := v_total + v_subtotal;

    update products
       set stock = stock - v_cantidad
     where id = v_producto.id;

    insert into order_items (
      order_id, product_id, referencia_snapshot, nombre_snapshot,
      cantidad, precio_unitario_aplicado, subtotal
    ) values (
      v_order_id, v_producto.id, v_producto.referencia, v_producto.nombre,
      v_cantidad, v_precio, v_subtotal
    );
  end loop;

  update orders set total = v_total where id = v_order_id;

  update access_codes
     set estado = 'usado', usado_en = now(), order_id = v_order_id
   where id = v_code.id;

  return jsonb_build_object(
    'order_id',      v_order_id,
    'numero_pedido', v_numero,
    'total',         v_total
  );
end;
$$;

revoke all on function crear_pedido(text, text, text, text, jsonb, text) from public;
grant execute on function crear_pedido(text, text, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- cancelar_pedido: devuelve el stock. Idempotente.
-- ---------------------------------------------------------------------
create or replace function cancelar_pedido(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  -- La bandera stock_devuelto hace que cancelar dos veces no duplique
  -- la devolución de inventario.
  if not v_order.stock_devuelto then
    update products p
       set stock = p.stock + oi.cantidad
      from order_items oi
     where oi.order_id = p_order_id
       and oi.product_id = p.id;

    update orders set stock_devuelto = true where id = p_order_id;
  end if;

  update orders set estado = 'cancelado' where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- generar_codigo: crea un código de 4 dígitos único entre los activos.
-- ---------------------------------------------------------------------
create or replace function generar_codigo(p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    char(4);
  v_horas   int;
  v_vence   timestamptz;
  v_intento int := 0;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  select coalesce(max(valor)::int, 24) into v_horas
    from store_settings where clave = 'horas_vigencia_codigo';

  v_vence := now() + make_interval(hours => v_horas);

  loop
    v_intento := v_intento + 1;
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

    begin
      insert into access_codes (code, creado_por, vence_en, nota)
      values (v_code, auth.uid(), v_vence, p_nota);
      return jsonb_build_object('code', v_code, 'vence_en', v_vence);
    exception when unique_violation then
      if v_intento > 100 then
        raise exception 'NO_HAY_CODIGOS_LIBRES';
      end if;
    end;
  end loop;
end;
$$;
```

- [ ] **Step 2: Escribir el archivo de pruebas SQL**

Crear `supabase/tests.sql`. Se ejecuta en el editor SQL de Supabase y no deja rastro: todo ocurre dentro de una transacción que se revierte al final.

```sql
-- =====================================================================
-- Anaya Beauty — Verificación de la lógica de negocio
-- Ejecutar CUARTO. No modifica datos: termina con rollback.
-- =====================================================================
begin;

do $$
declare
  v_cat    uuid;
  v_prod   uuid;
  v_res    jsonb;
  v_stock  int;
  v_estado estado_codigo;
  v_order  uuid;
  v_total  int;
  v_ok     boolean;
begin
  -- ---------- Datos de prueba ----------
  insert into categories (nombre, slug) values ('Prueba', 'prueba-test')
    returning id into v_cat;

  insert into products (referencia, nombre, category_id, stock)
    values ('TEST-001', 'Labial de prueba', v_cat, 10)
    returning id into v_prod;

  insert into price_tiers (product_id, min_cantidad, precio_unitario) values
    (v_prod, 1, 10000), (v_prod, 3, 9000), (v_prod, 6, 8000);

  -- ---------- 1. Motor de precios ----------
  assert precio_unitario_para(v_prod, 1) = 10000, 'precio 1 unidad';
  assert precio_unitario_para(v_prod, 2) = 10000, 'precio 2 unidades';
  assert precio_unitario_para(v_prod, 3) = 9000,  'precio 3 unidades';
  assert precio_unitario_para(v_prod, 5) = 9000,  'precio 5 unidades';
  assert precio_unitario_para(v_prod, 6) = 8000,  'precio 6 unidades';
  assert precio_unitario_para(v_prod, 99) = 8000, 'precio 99 unidades';
  raise notice 'OK 1 — motor de precios coincide con pricing.ts';

  -- ---------- 2. Pedido con código válido ----------
  insert into access_codes (code, vence_en) values ('1111', now() + interval '1 hour');

  v_res := crear_pedido('1111', 'Laura Prueba', '3001112233', 'Medellín',
             jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 3)),
             'hash-test-a');

  v_order := (v_res->>'order_id')::uuid;
  v_total := (v_res->>'total')::int;

  assert v_total = 27000, 'el total debe ser 27000, fue ' || v_total;
  assert v_res->>'numero_pedido' like 'AB-%', 'formato del número de pedido';

  select stock into v_stock from products where id = v_prod;
  assert v_stock = 7, 'el stock debe bajar de 10 a 7, quedó en ' || v_stock;

  select estado into v_estado from access_codes where code = '1111';
  assert v_estado = 'usado', 'el código debe quedar quemado';
  raise notice 'OK 2 — pedido creado, precio recalculado, stock descontado, código quemado';

  -- ---------- 3. El código no se puede reusar ----------
  v_ok := false;
  begin
    perform crear_pedido('1111', 'Otra', '3002223344', 'Cali',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-test-b');
  exception when others then
    v_ok := (sqlerrm like '%CODIGO_INVALIDO%');
  end;
  assert v_ok, 'reusar un código quemado debe fallar con CODIGO_INVALIDO';
  raise notice 'OK 3 — un código usado no sirve dos veces';

  -- ---------- 4. Código vencido ----------
  insert into access_codes (code, vence_en) values ('2222', now() - interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('2222', 'Vencida', '3003334455', 'Cali',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-test-c');
  exception when others then
    v_ok := (sqlerrm like '%CODIGO_VENCIDO%');
  end;
  assert v_ok, 'un código vencido debe ser rechazado';
  raise notice 'OK 4 — los códigos vencidos se rechazan';

  -- ---------- 5. Stock insuficiente y reversión total ----------
  insert into access_codes (code, vence_en) values ('3333', now() + interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('3333', 'Ambiciosa', '3004445566', 'Bogotá',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 999)),
              'hash-test-d');
  exception when others then
    v_ok := (sqlerrm like '%SIN_STOCK%');
  end;
  assert v_ok, 'pedir más de lo que hay debe fallar';

  select stock into v_stock from products where id = v_prod;
  assert v_stock = 7, 'tras el fallo el stock no debe moverse, quedó en ' || v_stock;

  select estado into v_estado from access_codes where code = '3333';
  assert v_estado = 'disponible', 'tras el fallo el código NO debe quemarse';
  raise notice 'OK 5 — si falla el stock, no se toca nada: ni inventario ni código';

  -- ---------- 6. Cancelación devuelve el stock ----------
  perform cancelar_pedido(v_order);
  select stock into v_stock from products where id = v_prod;
  assert v_stock = 10, 'cancelar debe devolver el stock a 10, quedó en ' || v_stock;
  raise notice 'OK 6 — cancelar un pedido devuelve el inventario';

  -- ---------- 7. Cancelar dos veces no duplica la devolución ----------
  perform cancelar_pedido(v_order);
  select stock into v_stock from products where id = v_prod;
  assert v_stock = 10, 'cancelar dos veces no debe subir el stock a 13, quedó en ' || v_stock;
  raise notice 'OK 7 — la cancelación es idempotente';

  -- ---------- 8. Límite de intentos ----------
  insert into code_attempts (ip_hash)
    select 'hash-bloqueado' from generate_series(1, 5);

  insert into access_codes (code, vence_en) values ('4444', now() + interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('4444', 'Bot', '3005556677', 'Bogotá',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-bloqueado');
  exception when others then
    v_ok := (sqlerrm like '%DEMASIADOS_INTENTOS%');
  end;
  assert v_ok, 'tras 5 intentos fallidos el dispositivo debe quedar bloqueado';
  raise notice 'OK 8 — el límite de intentos bloquea la fuerza bruta';

  -- ---------- 9. Carrito vacío ----------
  v_ok := false;
  begin
    perform crear_pedido('4444', 'Vacía', '3006667788', 'Cali',
              '[]'::jsonb, 'hash-test-e');
  exception when others then
    v_ok := (sqlerrm like '%CARRITO_VACIO%');
  end;
  assert v_ok, 'un carrito vacío debe rechazarse';
  raise notice 'OK 9 — no se aceptan pedidos vacíos';

  raise notice '=========================================';
  raise notice ' TODAS LAS PRUEBAS PASARON';
  raise notice '=========================================';
end $$;

rollback;
```

- [ ] **Step 3: Ejecutar las funciones en Supabase**

Pegar `supabase/functions.sql` en el editor SQL y ejecutar.
Expected: "Success. No rows returned".

- [ ] **Step 4: Ejecutar las pruebas SQL**

Pegar `supabase/tests.sql` en el editor SQL y ejecutar.
Expected: en el panel de mensajes aparecen `OK 1` a `OK 9` y luego `TODAS LAS PRUEBAS PASARON`. Si alguna aserción falla, el mensaje indica cuál. **No continuar hasta que las nueve pasen.**

- [ ] **Step 5: Verificar que la base quedó limpia**

```sql
select count(*) from orders;
select count(*) from products where referencia = 'TEST-001';
```

Expected: `0` en ambas — el `rollback` revirtió todos los datos de prueba.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat(db): crear_pedido transaccional, cancelación idempotente y pruebas SQL"
```

---

## Task 7: Clientes de Supabase y capa de datos del catálogo

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- Create: `src/lib/data/catalog.ts`
- Test: `src/lib/__tests__/catalog-mapeo.test.ts`

**Interfaces:**
- Consumes: `Producto`, `Categoria` de `@/lib/types`
- Produces:
  - `crearClienteNavegador()`, `crearClienteServidor()`, `clienteAdmin()`
  - `mapearProducto(fila: FilaProducto): Producto` (exportada para poder probarla)
  - `obtenerCategorias(): Promise<Categoria[]>`
  - `obtenerProductos(opciones?: { categoriaSlug?: string; busqueda?: string; orden?: "recientes" | "precio-asc" | "precio-desc" }): Promise<Producto[]>`
  - `obtenerProductoPorReferencia(referencia: string): Promise<Producto | null>`
  - `obtenerConfiguracionPublica(): Promise<Record<string, string>>`

- [ ] **Step 1: Escribir la prueba del mapeo de datos**

El mapeo `snake_case` → `camelCase` es donde se cuelan los errores silenciosos, así que se prueba de forma aislada.

Crear `src/lib/__tests__/catalog-mapeo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapearProducto } from "@/lib/data/catalog";

describe("mapearProducto", () => {
  it("traduce snake_case a camelCase y ordena los escalones", () => {
    const fila = {
      id: "p1",
      referencia: "REF-101",
      nombre: "Labial Rojo Pasión",
      descripcion: "Mate de larga duración",
      category_id: "c1",
      categories: { nombre: "Labiales" },
      imagen_principal: "https://ejemplo/labial.jpg",
      galeria: ["https://ejemplo/a.jpg"],
      stock: 12,
      activo: true,
      price_tiers: [
        { min_cantidad: 6, precio_unitario: 8000 },
        { min_cantidad: 1, precio_unitario: 10000 },
        { min_cantidad: 3, precio_unitario: 9000 },
      ],
    };

    const producto = mapearProducto(fila);

    expect(producto.referencia).toBe("REF-101");
    expect(producto.categoriaId).toBe("c1");
    expect(producto.categoriaNombre).toBe("Labiales");
    expect(producto.imagenPrincipal).toBe("https://ejemplo/labial.jpg");
    expect(producto.escalones).toEqual([
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ]);
  });

  it("tolera campos nulos sin romperse", () => {
    const producto = mapearProducto({
      id: "p2",
      referencia: "REF-999",
      nombre: "Sin datos",
      descripcion: null,
      category_id: null,
      categories: null,
      imagen_principal: null,
      galeria: null,
      stock: 0,
      activo: true,
      price_tiers: null,
    });

    expect(producto.galeria).toEqual([]);
    expect(producto.escalones).toEqual([]);
    expect(producto.categoriaNombre).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/data/catalog".

- [ ] **Step 3: Crear los tres clientes de Supabase**

Crear `src/lib/supabase/client.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Crear `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacenCookies.getAll(),
        setAll: (aGuardar) => {
          try {
            aGuardar.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, options)
            );
          } catch {
            // Los Server Components no pueden escribir cookies;
            // el middleware de sesión se encarga de refrescarlas.
          }
        },
      },
    }
  );
}
```

Crear `src/lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con clave de servicio: se salta Row Level Security.
 * Solo puede usarse en código de servidor. El import de "server-only"
 * hace que la compilación falle si alguien lo importa desde el navegador.
 */
export function clienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

Instalar la guarda:

```bash
npm install server-only
```

- [ ] **Step 4: Implementar la capa de datos del catálogo**

Crear `src/lib/data/catalog.ts`:

```ts
import { crearClienteServidor } from "@/lib/supabase/server";
import { precioDesde } from "@/lib/pricing";
import type { Producto, Categoria } from "@/lib/types";

const CAMPOS_PRODUCTO = `
  id, referencia, nombre, descripcion, category_id,
  imagen_principal, galeria, stock, activo,
  categories ( nombre ),
  price_tiers ( min_cantidad, precio_unitario )
`;

type FilaEscalon = { min_cantidad: number; precio_unitario: number };

export type FilaProducto = {
  id: string;
  referencia: string;
  nombre: string;
  descripcion: string | null;
  category_id: string | null;
  categories: { nombre: string } | { nombre: string }[] | null;
  imagen_principal: string | null;
  galeria: string[] | null;
  stock: number;
  activo: boolean;
  price_tiers: FilaEscalon[] | null;
};

export function mapearProducto(fila: FilaProducto): Producto {
  const categoria = Array.isArray(fila.categories) ? fila.categories[0] : fila.categories;

  return {
    id: fila.id,
    referencia: fila.referencia,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoriaId: fila.category_id,
    categoriaNombre: categoria?.nombre ?? null,
    imagenPrincipal: fila.imagen_principal,
    galeria: fila.galeria ?? [],
    stock: fila.stock,
    activo: fila.activo,
    escalones: (fila.price_tiers ?? [])
      .map((e) => ({ minCantidad: e.min_cantidad, precioUnitario: e.precio_unitario }))
      .sort((a, b) => a.minCantidad - b.minCantidad),
  };
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categories")
    .select("id, nombre, slug, orden, categoria_padre_id")
    .eq("activo", true)
    .order("orden");

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    slug: c.slug,
    orden: c.orden,
    categoriaPadreId: c.categoria_padre_id,
  }));
}

export async function obtenerProductos(opciones?: {
  categoriaSlug?: string;
  busqueda?: string;
  orden?: "recientes" | "precio-asc" | "precio-desc";
}): Promise<Producto[]> {
  const supabase = await crearClienteServidor();
  let consulta = supabase.from("products").select(CAMPOS_PRODUCTO).eq("activo", true);

  if (opciones?.categoriaSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opciones.categoriaSlug)
      .maybeSingle();
    if (cat) consulta = consulta.eq("category_id", cat.id);
  }

  if (opciones?.busqueda?.trim()) {
    const termino = `%${opciones.busqueda.trim()}%`;
    consulta = consulta.or(`nombre.ilike.${termino},referencia.ilike.${termino}`);
  }

  const { data, error } = await consulta.order("orden").limit(500);
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  const productos = (data as unknown as FilaProducto[]).map(mapearProducto);

  // El orden por precio se hace en memoria porque el precio surge de los
  // escalones, no de una columna de la tabla de productos.
  if (opciones?.orden === "precio-asc" || opciones?.orden === "precio-desc") {
    const signo = opciones.orden === "precio-asc" ? 1 : -1;
    productos.sort((a, b) => {
      const pa = a.escalones.length ? precioDesde(a.escalones) : 0;
      const pb = b.escalones.length ? precioDesde(b.escalones) : 0;
      return (pa - pb) * signo;
    });
  }

  return productos;
}

export async function obtenerProductoPorReferencia(referencia: string): Promise<Producto | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .select(CAMPOS_PRODUCTO)
    .eq("referencia", referencia)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  return data ? mapearProducto(data as unknown as FilaProducto) : null;
}

export async function obtenerConfiguracionPublica(): Promise<Record<string, string>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("store_settings").select("clave, valor").eq("publico", true);
  return Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor]));
}
```

- [ ] **Step 5: Ejecutar las pruebas**

Run: `npm test`
Expected: PASS, incluidas las dos pruebas de mapeo.

- [ ] **Step 6: Conectar el entorno y verificar contra Supabase real**

Copiar `.env.example` a `.env.local` y rellenar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` desde Supabase → Project Settings → API.

Insertar un producto de prueba desde el editor SQL de Supabase:

```sql
insert into categories (nombre, slug, orden) values ('Labiales', 'labiales', 1)
  on conflict (slug) do nothing;

insert into products (referencia, nombre, descripcion, category_id, stock)
select 'REF-101', 'Labial Rojo Pasión', 'Mate de larga duración', id, 12
  from categories where slug = 'labiales'
on conflict (referencia) do nothing;

insert into price_tiers (product_id, min_cantidad, precio_unitario)
select p.id, v.min_c, v.precio
  from products p, (values (1, 10000), (3, 9000), (6, 8000)) as v(min_c, precio)
 where p.referencia = 'REF-101'
on conflict (product_id, min_cantidad) do nothing;
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: clientes de Supabase y capa de datos del catálogo"
```

---

## Task 8: Página de catálogo

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/ui/Boton.tsx`, `src/components/ui/Insignia.tsx`
- Create: `src/components/catalogo/Encabezado.tsx`, `src/components/catalogo/Buscador.tsx`, `src/components/catalogo/ChipsCategorias.tsx`, `src/components/catalogo/TarjetaProducto.tsx`, `src/components/catalogo/GrillaProductos.tsx`
- Create: `public/logo.png`, `public/banner.jpg` (los entrega el propietario)

**Interfaces:**
- Consumes: `obtenerProductos`, `obtenerCategorias` de `@/lib/data/catalog`; `precioDesde` de `@/lib/pricing`; `pesos` de `@/lib/format`
- Produces: `<TarjetaProducto producto={Producto} />`, `<Boton variante="primario" | "secundario" | "fantasma">`, `<Insignia tono="alerta" | "neutro">`

- [ ] **Step 1: Guardar los recursos de marca**

Colocar el logo en `public/logo.png` y el banner en `public/banner.jpg`. Si aún no están disponibles, crear marcadores temporales de color sólido para no bloquear el desarrollo, y reemplazarlos antes de publicar.

- [ ] **Step 2: Crear los componentes base de interfaz**

Crear `src/components/ui/Boton.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma";
  ancho?: boolean;
};

const estilos = {
  primario:
    "bg-fucsia text-petalo hover:brightness-110 active:scale-[0.98] shadow-petalo",
  secundario:
    "bg-petalo text-fucsia border-2 border-fucsia-suave hover:border-fucsia",
  fantasma: "bg-transparent text-carbon-suave hover:text-fucsia",
};

export function Boton({ variante = "primario", ancho, className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`min-h-[44px] rounded-pastilla px-6 py-3 font-semibold transition
        disabled:opacity-40 disabled:pointer-events-none
        ${estilos[variante]} ${ancho ? "w-full" : ""} ${className}`}
    />
  );
}
```

Crear `src/components/ui/Insignia.tsx`:

```tsx
export function Insignia({
  children,
  tono = "neutro",
}: {
  children: React.ReactNode;
  tono?: "alerta" | "neutro";
}) {
  const estilo =
    tono === "alerta"
      ? "bg-fucsia/10 text-fucsia"
      : "bg-lila-suave/50 text-lila";
  return (
    <span className={`rounded-pastilla px-3 py-1 text-xs font-bold ${estilo}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Crear la tarjeta de producto**

Crear `src/components/catalogo/TarjetaProducto.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { precioDesde } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { Insignia } from "@/components/ui/Insignia";
import type { Producto } from "@/lib/types";

export function TarjetaProducto({ producto }: { producto: Producto }) {
  const sinStock = producto.stock === 0;
  const quedaPoco = producto.stock > 0 && producto.stock <= 5;
  const desde = producto.escalones.length ? precioDesde(producto.escalones) : null;

  return (
    <Link
      href={`/producto/${producto.referencia}`}
      className="group block rounded-tarjeta bg-petalo shadow-petalo overflow-hidden
                 transition hover:shadow-flotante focus:outline-none
                 focus:ring-2 focus:ring-fucsia"
      aria-label={`${producto.nombre}, referencia ${producto.referencia}`}
    >
      <div className="relative aspect-square bg-rosa-nube">
        {producto.imagenPrincipal ? (
          <Image
            src={producto.imagenPrincipal}
            alt={producto.nombre}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-lila-suave text-4xl">♡</div>
        )}

        {sinStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-petalo/75">
            <span className="font-display text-lg text-carbon-suave">Agotado</span>
          </div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <p className="text-[11px] font-bold tracking-wide text-lila">{producto.referencia}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-carbon">
          {producto.nombre}
        </h3>

        {desde !== null && (
          <p className="pt-1 text-base font-bold text-fucsia">
            <span className="text-[11px] font-normal text-carbon-suave">desde </span>
            {pesos(desde)}
          </p>
        )}

        {quedaPoco && <Insignia tono="alerta">Quedan {producto.stock}</Insignia>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Crear el buscador y los chips de categorías**

Crear `src/components/catalogo/Buscador.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function Buscador() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [termino, setTermino] = useState(parametros.get("q") ?? "");

  // Espera a que deje de escribir para no consultar en cada tecla
  useEffect(() => {
    const temporizador = setTimeout(() => {
      const nuevos = new URLSearchParams(parametros.toString());
      if (termino.trim()) nuevos.set("q", termino.trim());
      else nuevos.delete("q");
      router.replace(`/?${nuevos.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(temporizador);
  }, [termino]);

  return (
    <div className="relative">
      <input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Busca por nombre o referencia…"
        aria-label="Buscar productos"
        className="w-full rounded-pastilla border-2 border-lila-suave bg-petalo
                   px-5 py-3 text-sm outline-none transition
                   placeholder:text-carbon-suave/60 focus:border-fucsia"
      />
    </div>
  );
}
```

Crear `src/components/catalogo/ChipsCategorias.tsx`:

```tsx
import Link from "next/link";
import type { Categoria } from "@/lib/types";

export function ChipsCategorias({
  categorias,
  activa,
}: {
  categorias: Categoria[];
  activa?: string;
}) {
  const principales = categorias.filter((c) => c.categoriaPadreId === null);

  return (
    <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        <li>
          <Chip href="/" activo={!activa}>Todo ✨</Chip>
        </li>
        {principales.map((c) => (
          <li key={c.id}>
            <Chip href={`/?categoria=${c.slug}`} activo={activa === c.slug}>
              {c.nombre}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`inline-block whitespace-nowrap rounded-pastilla px-4 py-2 text-sm font-semibold transition
        ${activo ? "bg-fucsia text-petalo" : "bg-petalo text-carbon-suave hover:text-fucsia"}`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 5: Crear el encabezado y la grilla**

Crear `src/components/catalogo/Encabezado.tsx`:

```tsx
import Image from "next/image";

export function Encabezado() {
  return (
    <header className="space-y-4 pb-2 text-center">
      <div className="flex justify-center pt-6">
        <Image src="/logo.png" alt="Anaya Beauty" width={140} height={140} priority />
      </div>
      <p className="font-display text-2xl text-fucsia">Encuentra tus mejores productos</p>
      <p className="text-sm text-carbon-suave">y excelentes valores ✨</p>
    </header>
  );
}
```

Crear `src/components/catalogo/GrillaProductos.tsx`:

```tsx
import { TarjetaProducto } from "./TarjetaProducto";
import type { Producto } from "@/lib/types";

export function GrillaProductos({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) {
    return (
      <p className="py-16 text-center text-carbon-suave">
        No encontramos productos con esa búsqueda 💔
        <br />
        <span className="text-sm">Prueba con otro nombre o referencia.</span>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {productos.map((p) => (
        <TarjetaProducto key={p.id} producto={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Armar la página de catálogo**

Reemplazar `src/app/page.tsx`:

```tsx
import { Suspense } from "react";
import { obtenerProductos, obtenerCategorias } from "@/lib/data/catalog";
import { Encabezado } from "@/components/catalogo/Encabezado";
import { Buscador } from "@/components/catalogo/Buscador";
import { ChipsCategorias } from "@/components/catalogo/ChipsCategorias";
import { GrillaProductos } from "@/components/catalogo/GrillaProductos";

export const revalidate = 30;

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; orden?: string }>;
}) {
  const filtros = await searchParams;

  const [productos, categorias] = await Promise.all([
    obtenerProductos({
      busqueda: filtros.q,
      categoriaSlug: filtros.categoria,
      orden: filtros.orden as "precio-asc" | "precio-desc" | undefined,
    }),
    obtenerCategorias(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32">
      <Encabezado />

      <div className="sticky top-0 z-10 space-y-3 bg-rosa-nube/95 py-3 backdrop-blur">
        <Suspense fallback={<div className="h-12" />}>
          <Buscador />
        </Suspense>
        <ChipsCategorias categorias={categorias} activa={filtros.categoria} />
      </div>

      <GrillaProductos productos={productos} />
    </main>
  );
}
```

- [ ] **Step 7: Verificar en el navegador**

Run: `npm run dev` y abrir `http://localhost:3000`
Expected: se ve el encabezado con el logo, el buscador, el chip "Todo" y la tarjeta del producto REF-101 mostrando "desde $8.000". Buscar "REF-101" filtra correctamente. Reducir la ventana a 360 px de ancho: la grilla queda en dos columnas sin desbordes horizontales.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: página de catálogo con buscador, categorías y tarjetas de producto"
```

---

## Task 9: Detalle de producto con escalones y sugerencia de upsell

Esta pantalla es la que convierte pedidos de una unidad en pedidos de tres. La sugerencia de upsell es la pieza comercial más rentable del sistema.

**Files:**
- Create: `src/app/producto/[referencia]/page.tsx`
- Create: `src/components/producto/TablaEscalones.tsx`, `src/components/producto/SelectorCantidad.tsx`, `src/components/producto/PanelCompra.tsx`
- Test: `src/components/producto/__tests__/PanelCompra.test.tsx`

**Interfaces:**
- Consumes: `obtenerProductoPorReferencia`; `subtotalPara`, `sugerenciaUpsell`, `precioUnitarioPara` de `@/lib/pricing`; `agregarAlCarrito` de `@/lib/cart` (Task 10)
- Produces: `<PanelCompra producto={Producto} />`, `<TablaEscalones escalones={Escalon[]} cantidadActual={number} />`, `<SelectorCantidad valor cantidadMaxima alCambiar />`

> **Nota de orden:** esta tarea depende del carrito (Task 10). Impleméntala junto con Task 10 o intercambia el orden; el plan las presenta así porque el detalle de producto define la interfaz que el carrito debe soportar.

- [ ] **Step 1: Escribir la prueba del panel de compra**

Crear `src/components/producto/__tests__/PanelCompra.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelCompra } from "@/components/producto/PanelCompra";
import { usarCarrito } from "@/lib/cart";
import type { Producto } from "@/lib/types";

const labial: Producto = {
  id: "p1",
  referencia: "REF-101",
  nombre: "Labial Rojo Pasión",
  descripcion: null,
  categoriaId: null,
  categoriaNombre: null,
  imagenPrincipal: null,
  galeria: [],
  stock: 4,
  activo: true,
  escalones: [
    { minCantidad: 1, precioUnitario: 10000 },
    { minCantidad: 3, precioUnitario: 9000 },
    { minCantidad: 6, precioUnitario: 8000 },
  ],
};

describe("PanelCompra", () => {
  beforeEach(() => {
    usarCarrito.getState().vaciar();
  });

  it("muestra el subtotal del escalón que aplica", () => {
    render(<PanelCompra producto={labial} />);
    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$10.000");

    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    // 3 unidades entran al escalón de $9.000
    expect(screen.getByRole("button", { name: /agregar/i })).toHaveTextContent("$27.000");
  });

  it("sugiere el siguiente escalón con el ahorro real", () => {
    render(<PanelCompra producto={labial} />);
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i })); // 2 unidades
    expect(screen.getByText(/suma 1 más/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3\.000/)).toBeInTheDocument();
  });

  it("nunca permite pasar del stock disponible", () => {
    render(<PanelCompra producto={labial} />);
    const aumentar = screen.getByRole("button", { name: /aumentar/i });

    for (let i = 0; i < 10; i++) fireEvent.click(aumentar);

    expect(screen.getByLabelText(/cantidad/i)).toHaveTextContent("4");
    expect(aumentar).toBeDisabled();
  });

  it("agrega la cantidad elegida al carrito", () => {
    render(<PanelCompra producto={labial} />);
    fireEvent.click(screen.getByRole("button", { name: /aumentar/i }));
    fireEvent.click(screen.getByRole("button", { name: /agregar/i }));

    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 2 }]);
  });

  it("bloquea la compra cuando el producto está agotado", () => {
    render(<PanelCompra producto={{ ...labial, stock: 0 }} />);
    expect(screen.getByText(/agotado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/components/producto/PanelCompra".

- [ ] **Step 3: Crear el selector de cantidad**

Crear `src/components/producto/SelectorCantidad.tsx`:

```tsx
"use client";

export function SelectorCantidad({
  valor,
  cantidadMaxima,
  alCambiar,
}: {
  valor: number;
  cantidadMaxima: number;
  alCambiar: (nuevo: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        disabled={valor <= 1}
        onClick={() => alCambiar(valor - 1)}
        className="h-11 w-11 rounded-full border-2 border-fucsia-suave text-xl
                   font-bold text-fucsia transition disabled:opacity-30"
      >
        −
      </button>

      <span aria-label="Cantidad" className="min-w-[3rem] text-center font-display text-3xl">
        {valor}
      </span>

      <button
        type="button"
        aria-label="Aumentar cantidad"
        disabled={valor >= cantidadMaxima}
        onClick={() => alCambiar(valor + 1)}
        className="h-11 w-11 rounded-full bg-fucsia text-xl font-bold
                   text-petalo transition disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Crear la tabla de escalones**

Crear `src/components/producto/TablaEscalones.tsx`:

```tsx
import { pesos } from "@/lib/format";
import type { Escalon } from "@/lib/pricing";

export function TablaEscalones({
  escalones,
  cantidadActual,
}: {
  escalones: Escalon[];
  cantidadActual: number;
}) {
  const ordenados = [...escalones].sort((a, b) => a.minCantidad - b.minCantidad);

  const aplicable = ordenados.reduce(
    (mejor, e) => (e.minCantidad <= cantidadActual ? e : mejor),
    ordenados[0]
  );

  return (
    <ul className="space-y-1 rounded-suave bg-rosa-nube p-4">
      {ordenados.map((e) => {
        const activo = e.minCantidad === aplicable?.minCantidad;
        return (
          <li
            key={e.minCantidad}
            className={`flex items-center justify-between rounded-suave px-3 py-2 text-sm transition
              ${activo ? "bg-fucsia/10 font-bold text-fucsia" : "text-carbon-suave"}`}
          >
            <span>
              {e.minCantidad === 1 ? "1 unidad" : `${e.minCantidad} unidades o más`}
            </span>
            <span>{pesos(e.precioUnitario)} c/u</span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Crear el panel de compra**

Crear `src/components/producto/PanelCompra.tsx`:

```tsx
"use client";

import { useState } from "react";
import { subtotalPara, sugerenciaUpsell } from "@/lib/pricing";
import { pesos } from "@/lib/format";
import { usarCarrito } from "@/lib/cart";
import { Boton } from "@/components/ui/Boton";
import { SelectorCantidad } from "./SelectorCantidad";
import { TablaEscalones } from "./TablaEscalones";
import type { Producto } from "@/lib/types";

export function PanelCompra({ producto }: { producto: Producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const agregar = usarCarrito((e) => e.agregar);

  if (producto.stock === 0) {
    return (
      <div className="rounded-tarjeta bg-rosa-nube p-6 text-center">
        <p className="font-display text-xl text-carbon-suave">Agotado por ahora</p>
        <p className="mt-1 text-sm text-carbon-suave">
          Vuelve pronto, reponemos seguido 💕
        </p>
      </div>
    );
  }

  if (producto.escalones.length === 0) {
    return (
      <p className="rounded-tarjeta bg-rosa-nube p-6 text-center text-carbon-suave">
        Este producto todavía no tiene precio configurado.
      </p>
    );
  }

  const subtotal = subtotalPara(producto.escalones, cantidad);
  const upsell = sugerenciaUpsell(producto.escalones, cantidad);
  const puedeLlegarAlUpsell = upsell !== null && upsell.nuevaCantidad <= producto.stock;

  function alAgregar() {
    agregar(producto.id, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <div className="space-y-5">
      <TablaEscalones escalones={producto.escalones} cantidadActual={cantidad} />

      <SelectorCantidad
        valor={cantidad}
        cantidadMaxima={producto.stock}
        alCambiar={setCantidad}
      />

      {puedeLlegarAlUpsell && (
        <p className="rounded-suave bg-lila-suave/40 px-4 py-3 text-center text-sm text-lila">
          ✨ ¡Suma {upsell.unidadesFaltantes} más y te salen a{" "}
          <strong>{pesos(upsell.nuevoPrecioUnitario)} c/u</strong>!
          <br />
          Ahorras <strong>{pesos(upsell.ahorro)}</strong>
        </p>
      )}

      {producto.stock <= 5 && (
        <p className="text-center text-sm font-semibold text-fucsia">
          Quedan solo {producto.stock} disponibles
        </p>
      )}

      <Boton ancho onClick={alAgregar}>
        {agregado ? "¡Agregado! 💕" : `Agregar · ${pesos(subtotal)}`}
      </Boton>
    </div>
  );
}
```

- [ ] **Step 6: Crear la página de detalle**

Crear `src/app/producto/[referencia]/page.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerProductoPorReferencia } from "@/lib/data/catalog";
import { PanelCompra } from "@/components/producto/PanelCompra";

export const revalidate = 30;

export default async function PaginaProducto({
  params,
}: {
  params: Promise<{ referencia: string }>;
}) {
  const { referencia } = await params;
  const producto = await obtenerProductoPorReferencia(decodeURIComponent(referencia));

  if (!producto) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32">
      <Link
        href="/"
        className="inline-block py-4 text-sm font-semibold text-lila hover:text-fucsia"
      >
        ← Seguir viendo
      </Link>

      <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-petalo shadow-petalo">
        {producto.imagenPrincipal ? (
          <Image
            src={producto.imagenPrincipal}
            alt={producto.nombre}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl text-lila-suave">♡</div>
        )}
      </div>

      <div className="space-y-2 py-5">
        <p className="text-xs font-bold tracking-widest text-lila">{producto.referencia}</p>
        <h1 className="font-display text-3xl leading-tight text-carbon">{producto.nombre}</h1>
        {producto.descripcion && (
          <p className="text-sm leading-relaxed text-carbon-suave">{producto.descripcion}</p>
        )}
      </div>

      <PanelCompra producto={producto} />
    </main>
  );
}
```

- [ ] **Step 7: Ejecutar las pruebas**

Run: `npm test`
Expected: PASS, las cinco pruebas de `PanelCompra`.

- [ ] **Step 8: Verificar en el navegador**

Abrir `http://localhost:3000/producto/REF-101`.
Expected: con 1 unidad el botón dice "Agregar · $10.000"; al subir a 2 aparece la sugerencia de sumar 1 más para ahorrar $3.000; con 3 el botón dice "$27.000" y la fila de "3 unidades o más" queda resaltada.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: detalle de producto con escalones y sugerencia de upsell"
```

---

## Task 10: Estado del carrito y página del carrito

**Files:**
- Create: `src/lib/cart.ts`
- Create: `src/app/carrito/page.tsx`, `src/app/carrito/actions.ts`, `src/app/carrito/VistaCarrito.tsx`
- Create: `src/components/carrito/BotonFlotante.tsx`, `src/components/carrito/LineaCarrito.tsx`
- Modify: `src/app/layout.tsx` (añadir el botón flotante)
- Test: `src/lib/__tests__/cart.test.ts`

**Interfaces:**
- Consumes: `LineaCarrito` de `@/lib/types`
- Produces:
  - `usarCarrito` (store de Zustand) con estado `{ lineas: LineaCarrito[]; codigo: string | null }`
  - Acciones: `agregar(productoId, cantidad)`, `establecer(productoId, cantidad)`, `quitar(productoId)`, `vaciar()`, `guardarCodigo(codigo)`
  - Selectores: `totalUnidades(estado): number`
  - `cargarProductosDelCarrito(ids: string[]): Promise<Producto[]>` (server action)

- [ ] **Step 1: Escribir las pruebas del carrito**

Crear `src/lib/__tests__/cart.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usarCarrito, totalUnidades } from "@/lib/cart";

describe("carrito", () => {
  beforeEach(() => usarCarrito.getState().vaciar());

  it("agrega un producto nuevo", () => {
    usarCarrito.getState().agregar("p1", 2);
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 2 }]);
  });

  it("suma la cantidad si el producto ya estaba", () => {
    usarCarrito.getState().agregar("p1", 2);
    usarCarrito.getState().agregar("p1", 3);
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p1", cantidad: 5 }]);
  });

  it("mantiene productos distintos como líneas separadas", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().agregar("p2", 4);
    expect(usarCarrito.getState().lineas).toHaveLength(2);
  });

  it("establece una cantidad exacta", () => {
    usarCarrito.getState().agregar("p1", 5);
    usarCarrito.getState().establecer("p1", 2);
    expect(usarCarrito.getState().lineas[0].cantidad).toBe(2);
  });

  it("elimina la línea si la cantidad baja a cero", () => {
    usarCarrito.getState().agregar("p1", 3);
    usarCarrito.getState().establecer("p1", 0);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });

  it("quita un producto", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().agregar("p2", 1);
    usarCarrito.getState().quitar("p1");
    expect(usarCarrito.getState().lineas).toEqual([{ productoId: "p2", cantidad: 1 }]);
  });

  it("cuenta el total de unidades", () => {
    usarCarrito.getState().agregar("p1", 3);
    usarCarrito.getState().agregar("p2", 4);
    expect(totalUnidades(usarCarrito.getState())).toBe(7);
  });

  it("guarda el código que llega por el link mágico", () => {
    usarCarrito.getState().guardarCodigo("4821");
    expect(usarCarrito.getState().codigo).toBe("4821");
  });

  it("vaciar borra las líneas y el código", () => {
    usarCarrito.getState().agregar("p1", 1);
    usarCarrito.getState().guardarCodigo("4821");
    usarCarrito.getState().vaciar();
    expect(usarCarrito.getState().lineas).toEqual([]);
    expect(usarCarrito.getState().codigo).toBeNull();
  });

  it("ignora cantidades inválidas", () => {
    usarCarrito.getState().agregar("p1", 0);
    usarCarrito.getState().agregar("p2", -3);
    expect(usarCarrito.getState().lineas).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/cart".

- [ ] **Step 3: Implementar el store del carrito**

Crear `src/lib/cart.ts`:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineaCarrito } from "@/lib/types";

type EstadoCarrito = {
  lineas: LineaCarrito[];
  codigo: string | null;
  agregar: (productoId: string, cantidad: number) => void;
  establecer: (productoId: string, cantidad: number) => void;
  quitar: (productoId: string) => void;
  vaciar: () => void;
  guardarCodigo: (codigo: string) => void;
};

export const usarCarrito = create<EstadoCarrito>()(
  persist(
    (set) => ({
      lineas: [],
      codigo: null,

      agregar: (productoId, cantidad) =>
        set((estado) => {
          if (!Number.isInteger(cantidad) || cantidad < 1) return estado;
          const existente = estado.lineas.find((l) => l.productoId === productoId);
          return existente
            ? {
                lineas: estado.lineas.map((l) =>
                  l.productoId === productoId ? { ...l, cantidad: l.cantidad + cantidad } : l
                ),
              }
            : { lineas: [...estado.lineas, { productoId, cantidad }] };
        }),

      establecer: (productoId, cantidad) =>
        set((estado) => ({
          lineas:
            cantidad < 1
              ? estado.lineas.filter((l) => l.productoId !== productoId)
              : estado.lineas.map((l) =>
                  l.productoId === productoId ? { ...l, cantidad } : l
                ),
        })),

      quitar: (productoId) =>
        set((estado) => ({ lineas: estado.lineas.filter((l) => l.productoId !== productoId) })),

      vaciar: () => set({ lineas: [], codigo: null }),

      guardarCodigo: (codigo) => set({ codigo }),
    }),
    {
      name: "anaya-carrito",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function totalUnidades(estado: { lineas: LineaCarrito[] }): number {
  return estado.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS, las diez pruebas del carrito.

- [ ] **Step 5: Crear la acción que carga los productos del carrito**

El carrito vive en el navegador y solo guarda identificadores; los datos completos se piden al servidor.

Crear `src/app/carrito/actions.ts`:

```ts
"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { mapearProducto, type FilaProducto } from "@/lib/data/catalog";
import type { Producto } from "@/lib/types";

export async function cargarProductosDelCarrito(ids: string[]): Promise<Producto[]> {
  if (ids.length === 0) return [];

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, referencia, nombre, descripcion, category_id,
      imagen_principal, galeria, stock, activo,
      categories ( nombre ),
      price_tiers ( min_cantidad, precio_unitario )
    `)
    .in("id", ids)
    .eq("activo", true);

  if (error) throw new Error(`No se pudo cargar el carrito: ${error.message}`);
  return (data as unknown as FilaProducto[]).map(mapearProducto);
}
```

- [ ] **Step 6: Crear el botón flotante del carrito**

Crear `src/components/carrito/BotonFlotante.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usarCarrito, totalUnidades } from "@/lib/cart";

export function BotonFlotante() {
  const [montado, setMontado] = useState(false);
  const lineas = usarCarrito((e) => e.lineas);
  const unidades = totalUnidades({ lineas });

  // Evita el desajuste entre servidor y navegador: localStorage no
  // existe durante el renderizado en el servidor.
  useEffect(() => setMontado(true), []);
  if (!montado || unidades === 0) return null;

  return (
    <Link
      href="/carrito"
      aria-label={`Ver carrito, ${unidades} productos`}
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3
                 rounded-pastilla bg-fucsia px-7 py-4 font-semibold text-petalo
                 shadow-flotante transition hover:brightness-110"
    >
      <span>Ver mi pedido</span>
      <span
        key={unidades}
        className="flex h-7 min-w-7 animate-[rebote_0.4s_ease] items-center justify-center
                   rounded-full bg-petalo px-2 text-sm font-bold text-fucsia"
      >
        {unidades}
      </span>
    </Link>
  );
}
```

Añadir la animación al final de `src/app/globals.css`:

```css
@keyframes rebote {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 7: Montar el botón flotante en el layout**

En `src/app/layout.tsx`, importar el componente y renderizarlo dentro de `<body>`, después de `{children}`:

```tsx
import { BotonFlotante } from "@/components/carrito/BotonFlotante";

// …dentro de <body>:
        {children}
        <BotonFlotante />
```

- [ ] **Step 8: Crear la vista del carrito**

Crear `src/app/carrito/VistaCarrito.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usarCarrito } from "@/lib/cart";
import { cargarProductosDelCarrito } from "./actions";
import { subtotalPara, precioUnitarioPara, precioDesde } from "@/lib/pricing";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import type { Producto } from "@/lib/types";

export function VistaCarrito() {
  const { lineas, establecer, quitar } = usarCarrito();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarProductosDelCarrito(lineas.map((l) => l.productoId))
      .then(setProductos)
      .finally(() => setCargando(false));
  }, [lineas.length]);

  if (cargando) {
    return <p className="py-20 text-center text-carbon-suave">Cargando tu pedido…</p>;
  }

  if (lineas.length === 0) {
    return (
      <div className="space-y-5 py-20 text-center">
        <p className="font-display text-2xl text-carbon">Tu bolsa está vacía ♡</p>
        <p className="text-sm text-carbon-suave">Vuelve al catálogo y consiéntete.</p>
        <Link href="/">
          <Boton>Ver el catálogo</Boton>
        </Link>
      </div>
    );
  }

  const detalles = lineas
    .map((linea) => {
      const producto = productos.find((p) => p.id === linea.productoId);
      if (!producto || producto.escalones.length === 0) return null;
      const cantidad = Math.min(linea.cantidad, producto.stock);
      return {
        linea,
        producto,
        cantidad,
        subtotal: subtotalPara(producto.escalones, cantidad),
        precioUnitario: precioUnitarioPara(producto.escalones, cantidad),
        ajustado: cantidad !== linea.cantidad,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const total = detalles.reduce((suma, d) => suma + d.subtotal, 0);

  // Cuánto se ahorró frente a comprar todo al precio de una sola unidad
  const ahorro = detalles.reduce((suma, d) => {
    const masCaro = Math.max(...d.producto.escalones.map((e) => e.precioUnitario));
    return suma + (masCaro - d.precioUnitario) * d.cantidad;
  }, 0);

  return (
    <div className="space-y-4">
      {detalles.map((d) => (
        <article key={d.producto.id} className="flex gap-3 rounded-tarjeta bg-petalo p-3 shadow-petalo">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-suave bg-rosa-nube">
            {d.producto.imagenPrincipal && (
              <Image src={d.producto.imagenPrincipal} alt={d.producto.nombre} fill className="object-cover" sizes="80px" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-lila">{d.producto.referencia}</p>
            <h3 className="truncate text-sm font-semibold">{d.producto.nombre}</h3>
            <p className="text-xs text-carbon-suave">{pesos(d.precioUnitario)} c/u</p>

            {d.ajustado && (
              <p className="text-xs font-semibold text-fucsia">
                Ajustamos a {d.cantidad}: es lo que queda disponible
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                aria-label={`Disminuir ${d.producto.nombre}`}
                onClick={() => establecer(d.producto.id, d.cantidad - 1)}
                className="h-9 w-9 rounded-full border border-fucsia-suave text-fucsia"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{d.cantidad}</span>
              <button
                aria-label={`Aumentar ${d.producto.nombre}`}
                disabled={d.cantidad >= d.producto.stock}
                onClick={() => establecer(d.producto.id, d.cantidad + 1)}
                className="h-9 w-9 rounded-full bg-fucsia text-petalo disabled:opacity-30"
              >
                +
              </button>
              <button
                onClick={() => quitar(d.producto.id)}
                className="ml-auto text-xs text-carbon-suave underline"
              >
                Quitar
              </button>
            </div>
          </div>

          <p className="shrink-0 self-center font-bold text-fucsia">{pesos(d.subtotal)}</p>
        </article>
      ))}

      <div className="space-y-2 rounded-tarjeta bg-petalo p-5 shadow-petalo">
        {ahorro > 0 && (
          <p className="text-center text-sm font-semibold text-lila">
            ✨ Estás ahorrando {pesos(ahorro)} con tus combos
          </p>
        )}
        <div className="flex items-center justify-between border-t border-rosa-nube pt-3">
          <span className="font-display text-xl">Total</span>
          <span className="font-display text-2xl text-fucsia">{pesos(total)}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-tarjeta bg-lila-suave/30 p-5 text-center">
        <p className="text-sm text-carbon">
          Para confirmar tu pedido necesitas tu <strong>código de 4 dígitos</strong>.
          Escríbenos y te lo enviamos apenas confirmemos tu pago 💕
        </p>
        <a
          href={enlaceWhatsApp("¡Hola! Quiero mi código para hacer mi pedido 💕")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Boton variante="secundario" ancho>Pedir mi código por WhatsApp</Boton>
        </a>
      </div>

      <Link href="/confirmar">
        <Boton ancho>Ya tengo mi código · Confirmar</Boton>
      </Link>
    </div>
  );
}
```

- [ ] **Step 9: Crear la página del carrito**

Crear `src/app/carrito/page.tsx`:

```tsx
import Link from "next/link";
import { VistaCarrito } from "./VistaCarrito";

export default function PaginaCarrito() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-32">
      <Link href="/" className="inline-block py-4 text-sm font-semibold text-lila hover:text-fucsia">
        ← Seguir comprando
      </Link>
      <h1 className="pb-4 font-display text-3xl text-carbon">Mi pedido</h1>
      <VistaCarrito />
    </main>
  );
}
```

- [ ] **Step 10: Verificar el recorrido en el navegador**

Agregar dos productos desde el detalle, abrir `/carrito`.
Expected: aparecen ambas líneas con sus subtotales, el total coincide con la suma, los botones de más y menos funcionan, y el botón flotante muestra el número correcto de unidades. Recargar la página: el carrito sigue ahí.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: carrito persistente con botón flotante y ajuste automático por stock"
```

---

## Task 11: Link mágico, confirmación del pedido y envío del correo

La tarea que cierra la venta. Incluye el correo porque el envío es el último paso de la misma operación y no tiene sentido probarlo por separado.

**Files:**
- Create: `src/app/c/[codigo]/route.ts`
- Create: `src/app/confirmar/page.tsx`, `src/app/confirmar/FormularioConfirmar.tsx`, `src/app/confirmar/actions.ts`
- Create: `src/lib/email/order-template.ts`, `src/lib/email/send-order.ts`
- Test: `src/lib/__tests__/order-template.test.ts`

**Interfaces:**
- Consumes: `usarCarrito`; `clienteAdmin`; `pesos`
- Produces:
  - `confirmarPedido(estadoPrevio: ResultadoConfirmacion | null, datos: FormData): Promise<ResultadoConfirmacion>`
  - `type ResultadoConfirmacion = { ok: true; pedidoId: string; numeroPedido: string } | { ok: false; mensaje: string }`
  - `plantillaCorreoPedido(datos: DatosCorreo): string`
  - `enviarCorreoPedido(datos: DatosCorreo): Promise<void>`
  - `type DatosCorreo = { numeroPedido: string; nombre: string; whatsapp: string; ciudad: string; codigo: string; total: number; lineas: { referencia: string; nombre: string; cantidad: number; subtotal: number }[] }`

- [ ] **Step 1: Crear la ruta del link mágico**

Crear `src/app/c/[codigo]/route.ts`:

```ts
import { NextResponse } from "next/server";

/**
 * Link mágico: la administradora comparte /c/4821 por WhatsApp y con un
 * toque la clienta llega a la confirmación con el código ya aplicado.
 * El código viaja como parámetro para que el formulario lo autorellene.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const limpio = codigo.replace(/\D/g, "").slice(0, 4);

  const destino = limpio.length === 4 ? `/confirmar?codigo=${limpio}` : "/carrito";
  return NextResponse.redirect(new URL(destino, process.env.NEXT_PUBLIC_SITE_URL));
}
```

- [ ] **Step 2: Escribir la prueba de la plantilla del correo**

Crear `src/lib/__tests__/order-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { plantillaCorreoPedido } from "@/lib/email/order-template";

const datos = {
  numeroPedido: "AB-0043",
  nombre: "Laura Gómez",
  whatsapp: "3001234567",
  ciudad: "Medellín",
  codigo: "4821",
  total: 74000,
  lineas: [
    { referencia: "REF-101", nombre: "Labial Rojo Pasión", cantidad: 3, subtotal: 27000 },
    { referencia: "REF-233", nombre: "Rubor Durazno", cantidad: 1, subtotal: 12000 },
    { referencia: "REF-410", nombre: "Base Mate Natural", cantidad: 1, subtotal: 35000 },
  ],
};

describe("plantillaCorreoPedido", () => {
  it("incluye los datos que la administradora necesita para despachar", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).toContain("AB-0043");
    expect(html).toContain("Laura Gómez");
    expect(html).toContain("3001234567");
    expect(html).toContain("Medellín");
    expect(html).toContain("4821");
  });

  it("lista cada producto con su referencia y subtotal", () => {
    const html = plantillaCorreoPedido(datos);
    expect(html).toContain("REF-101");
    expect(html).toContain("Labial Rojo Pasión");
    expect(html).toContain("$27.000");
    expect(html).toContain("REF-410");
  });

  it("muestra el total formateado en pesos", () => {
    expect(plantillaCorreoPedido(datos)).toContain("$74.000");
  });

  it("escapa el HTML de los datos que escribe la clienta", () => {
    const html = plantillaCorreoPedido({ ...datos, nombre: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/email/order-template".

- [ ] **Step 4: Implementar la plantilla del correo**

Crear `src/lib/email/order-template.ts`:

```ts
import { pesos } from "@/lib/format";

export type DatosCorreo = {
  numeroPedido: string;
  nombre: string;
  whatsapp: string;
  ciudad: string;
  codigo: string;
  total: number;
  lineas: { referencia: string; nombre: string; cantidad: number; subtotal: number }[];
};

/** Los datos vienen de un formulario público: siempre se escapan. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plantillaCorreoPedido(datos: DatosCorreo): string {
  const filas = datos.lineas
    .map(
      (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;">
            <span style="color:#A97FD0;font-size:11px;font-weight:bold;">${escapar(l.referencia)}</span><br>
            <span style="color:#3D2B36;font-size:14px;">${escapar(l.nombre)}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:center;color:#3D2B36;">
            x${l.cantidad}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #FDF2F7;text-align:right;color:#E5308A;font-weight:bold;">
            ${pesos(l.subtotal)}
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#FDF2F7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 4px;color:#A97FD0;font-size:12px;letter-spacing:2px;">ANAYA BEAUTY</p>
      <h1 style="margin:0 0 20px;color:#E5308A;font-size:26px;">Pedido ${escapar(datos.numeroPedido)}</h1>

      <table role="presentation" width="100%" style="background:#FDF2F7;border-radius:12px;padding:16px;margin-bottom:20px;">
        <tr><td style="color:#3D2B36;font-size:14px;line-height:1.8;">
          <strong>${escapar(datos.nombre)}</strong><br>
          WhatsApp: ${escapar(datos.whatsapp)}<br>
          Ciudad: ${escapar(datos.ciudad)}<br>
          <span style="color:#7A6470;font-size:12px;">Código usado: ${escapar(datos.codigo)}</span>
        </td></tr>
      </table>

      <table role="presentation" width="100%">
        ${filas}
        <tr>
          <td colspan="2" style="padding-top:16px;font-size:18px;color:#3D2B36;">TOTAL</td>
          <td style="padding-top:16px;text-align:right;font-size:22px;color:#E5308A;font-weight:bold;">
            ${pesos(datos.total)}
          </td>
        </tr>
      </table>

      <p style="margin-top:28px;text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/pedidos"
           style="display:inline-block;background:#E5308A;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;">
          Ver en el panel
        </a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS, las cuatro pruebas de la plantilla.

- [ ] **Step 6: Implementar el envío del correo**

Crear `src/lib/email/send-order.ts`:

```ts
import "server-only";
import { Resend } from "resend";
import { plantillaCorreoPedido, type DatosCorreo } from "./order-template";
import { pesos } from "@/lib/format";

/**
 * Envía el aviso de pedido nuevo.
 *
 * Nunca lanza: si el correo falla, el pedido ya está guardado y visible en
 * el panel. Perder el aviso es molesto; perder la venta sería grave.
 */
export async function enviarCorreoPedido(datos: DatosCorreo): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  const destino = process.env.CORREO_DESTINO;

  if (!clave || !destino) {
    console.error("[correo] falta RESEND_API_KEY o CORREO_DESTINO");
    return;
  }

  try {
    const resend = new Resend(clave);
    await resend.emails.send({
      from: "Anaya Beauty <onboarding@resend.dev>",
      to: destino,
      subject: `Pedido ${datos.numeroPedido} — ${datos.nombre} — ${pesos(datos.total)}`,
      html: plantillaCorreoPedido(datos),
    });
  } catch (error) {
    console.error("[correo] no se pudo enviar el aviso del pedido", error);
  }
}
```

- [ ] **Step 7: Implementar la acción de confirmación**

Crear `src/app/confirmar/actions.ts`:

```ts
"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { enviarCorreoPedido } from "@/lib/email/send-order";

export type ResultadoConfirmacion =
  | { ok: true; pedidoId: string; numeroPedido: string }
  | { ok: false; mensaje: string };

/** Hash con sal de la IP: sirve para el límite de intentos sin guardar la IP. */
async function hashDelDispositivo(): Promise<string> {
  const cabeceras = await headers();
  const ip = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  return createHash("sha256").update(ip + (process.env.SAL_HASH_IP ?? "")).digest("hex");
}

/** Traduce los errores de PostgreSQL a mensajes que la clienta entiende. */
function mensajeAmable(errorCrudo: string): string {
  if (errorCrudo.includes("DEMASIADOS_INTENTOS"))
    return "Demasiados intentos seguidos. Espera 10 minutos e inténtalo otra vez 💕";
  if (errorCrudo.includes("CODIGO_INVALIDO"))
    return "Ese código no es válido o ya fue usado. Escríbenos por WhatsApp y te ayudamos ✨";
  if (errorCrudo.includes("CODIGO_VENCIDO"))
    return "Tu código ya venció. Pídenos uno nuevo por WhatsApp 💕";
  if (errorCrudo.includes("SIN_STOCK")) {
    const [, nombre, disponible] = errorCrudo.split("|");
    return `Se agotó parte de tu pedido: de ${nombre} solo quedan ${disponible}. Ajusta tu carrito e inténtalo de nuevo.`;
  }
  if (errorCrudo.includes("PRODUCTO_NO_DISPONIBLE"))
    return "Uno de los productos de tu bolsa ya no está disponible. Revisa tu carrito 💔";
  if (errorCrudo.includes("CARRITO_VACIO")) return "Tu bolsa está vacía.";
  if (errorCrudo.includes("DATOS_INCOMPLETOS"))
    return "Necesitamos tu nombre, WhatsApp y ciudad para poder enviarte.";
  return "No pudimos crear tu pedido. Escríbenos por WhatsApp y lo resolvemos ✨";
}

export async function confirmarPedido(
  _estadoPrevio: ResultadoConfirmacion | null,
  datos: FormData
): Promise<ResultadoConfirmacion> {
  const codigo = String(datos.get("codigo") ?? "").replace(/\D/g, "").slice(0, 4);
  const nombre = String(datos.get("nombre") ?? "").trim();
  const whatsapp = String(datos.get("whatsapp") ?? "").trim();
  const ciudad = String(datos.get("ciudad") ?? "").trim();
  const items = JSON.parse(String(datos.get("items") ?? "[]"));

  if (codigo.length !== 4) return { ok: false, mensaje: "El código debe tener 4 dígitos." };
  if (!nombre || !whatsapp || !ciudad)
    return { ok: false, mensaje: "Completa tu nombre, WhatsApp y ciudad." };

  const supabase = clienteAdmin();

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_codigo: codigo,
    p_nombre: nombre,
    p_whatsapp: whatsapp,
    p_ciudad: ciudad,
    p_items: items,
    p_ip_hash: await hashDelDispositivo(),
  });

  if (error) return { ok: false, mensaje: mensajeAmable(error.message) };

  const pedidoId = data.order_id as string;
  const numeroPedido = data.numero_pedido as string;

  // El correo va después de que la transacción confirmó. Si falla, el
  // pedido ya está guardado; enviarCorreoPedido no lanza.
  const { data: lineas } = await supabase
    .from("order_items")
    .select("referencia_snapshot, nombre_snapshot, cantidad, subtotal")
    .eq("order_id", pedidoId);

  await enviarCorreoPedido({
    numeroPedido,
    nombre,
    whatsapp,
    ciudad,
    codigo,
    total: data.total as number,
    lineas: (lineas ?? []).map((l) => ({
      referencia: l.referencia_snapshot,
      nombre: l.nombre_snapshot,
      cantidad: l.cantidad,
      subtotal: l.subtotal,
    })),
  });

  return { ok: true, pedidoId, numeroPedido };
}
```

- [ ] **Step 8: Crear el formulario de confirmación**

Crear `src/app/confirmar/FormularioConfirmar.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usarCarrito } from "@/lib/cart";
import { confirmarPedido, type ResultadoConfirmacion } from "./actions";
import { Boton } from "@/components/ui/Boton";
import { enlaceWhatsApp } from "@/lib/format";

export function FormularioConfirmar() {
  const router = useRouter();
  const parametros = useSearchParams();
  const { lineas, codigo, guardarCodigo, vaciar } = usarCarrito();
  const [estado, accion, enviando] = useActionState<ResultadoConfirmacion | null, FormData>(
    confirmarPedido,
    null
  );
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  // El link mágico trae el código en la URL: se guarda y se autorellena.
  const codigoDeLaUrl = parametros.get("codigo");
  useEffect(() => {
    if (codigoDeLaUrl && codigoDeLaUrl.length === 4) guardarCodigo(codigoDeLaUrl);
  }, [codigoDeLaUrl]);

  // Al confirmar, se vacía la bolsa y se muestra la pantalla de éxito.
  useEffect(() => {
    if (estado?.ok) {
      vaciar();
      router.push(`/pedido/${estado.pedidoId}`);
    }
  }, [estado]);

  if (!montado) return null;

  if (lineas.length === 0) {
    return (
      <p className="py-20 text-center text-carbon-suave">
        Tu bolsa está vacía. Vuelve al catálogo para armar tu pedido ♡
      </p>
    );
  }

  const campo =
    "w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-3 outline-none transition focus:border-fucsia";

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="items" value={JSON.stringify(
        lineas.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad }))
      )} />

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Tu código de 4 dígitos</span>
        <input
          name="codigo"
          inputMode="numeric"
          maxLength={4}
          required
          defaultValue={codigo ?? codigoDeLaUrl ?? ""}
          placeholder="0000"
          className={`${campo} text-center font-display text-3xl tracking-[0.5em]`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Tu nombre completo</span>
        <input name="nombre" required maxLength={80} className={campo} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Tu WhatsApp</span>
        <input name="whatsapp" inputMode="tel" required maxLength={20}
               placeholder="300 123 4567" className={campo} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Tu ciudad</span>
        <input name="ciudad" required maxLength={60} className={campo} />
      </label>

      {estado && !estado.ok && (
        <div className="space-y-2 rounded-suave bg-fucsia/10 p-4 text-center">
          <p className="text-sm font-semibold text-fucsia">{estado.mensaje}</p>
          <a href={enlaceWhatsApp("Hola, tuve un problema al confirmar mi pedido")}
             target="_blank" rel="noopener noreferrer"
             className="text-xs underline">
            Escribirnos por WhatsApp
          </a>
        </div>
      )}

      <Boton ancho type="submit" disabled={enviando}>
        {enviando ? "Confirmando tu pedido…" : "Confirmar mi pedido 💕"}
      </Boton>
    </form>
  );
}
```

- [ ] **Step 9: Crear la página de confirmación**

Crear `src/app/confirmar/page.tsx`:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { FormularioConfirmar } from "./FormularioConfirmar";

export default function PaginaConfirmar() {
  return (
    <main className="mx-auto max-w-md px-4 pb-32">
      <Link href="/carrito" className="inline-block py-4 text-sm font-semibold text-lila">
        ← Volver a mi pedido
      </Link>
      <h1 className="pb-1 font-display text-3xl">Ya casi es tuyo ✨</h1>
      <p className="pb-6 text-sm text-carbon-suave">
        Ingresa tu código y tus datos para confirmar.
      </p>
      <Suspense fallback={<p className="text-carbon-suave">Cargando…</p>}>
        <FormularioConfirmar />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 10: Probar el recorrido completo**

Generar un código de prueba en el editor SQL de Supabase:

```sql
insert into access_codes (code, vence_en) values ('4821', now() + interval '24 hours');
```

Con el servidor corriendo: agregar productos, abrir `http://localhost:3000/c/4821`.
Expected: redirige a la confirmación con el código ya escrito. Al completar los datos y enviar, redirige a la pantalla de pedido, el carrito queda vacío, y en Supabase aparecen la fila en `orders`, sus `order_items`, el stock descontado y el código en estado `usado`.

- [ ] **Step 11: Probar el rechazo del código reusado**

Volver a agregar productos e intentar confirmar con el mismo `4821`.
Expected: mensaje "Ese código no es válido o ya fue usado", con el enlace a WhatsApp. El carrito **no** se vacía.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: link mágico, confirmación transaccional del pedido y correo de aviso"
```

---

## Task 12: Pantalla de éxito

**Files:**
- Create: `src/app/pedido/[id]/page.tsx`
- Create: `src/lib/data/orders.ts`

**Interfaces:**
- Consumes: `clienteAdmin`; `obtenerConfiguracionPublica`; `pesos`, `enlaceWhatsApp`
- Produces: `obtenerPedidoPorId(id: string): Promise<Pedido | null>`

> **Refinamiento sobre el spec:** el spec proponía la ruta `/pedido/[numero]`. Se usa el identificador interno (`uuid`) en su lugar, porque los números consecutivos (`AB-0001`, `AB-0002`) son adivinables y expondrían los datos personales de otras clientas. El número de pedido se sigue mostrando en pantalla; solo cambia lo que viaja en la dirección.

- [ ] **Step 1: Crear la consulta de pedido**

Crear `src/lib/data/orders.ts`:

```ts
import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Pedido } from "@/lib/types";

export async function obtenerPedidoPorId(id: string): Promise<Pedido | null> {
  // El uuid es impredecible: sirve como llave de acceso a la pantalla
  // de éxito sin exponer los pedidos de otras clientas.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = clienteAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad,
      total, estado, notas_admin, created_at,
      access_codes ( code ),
      order_items ( id, referencia_snapshot, nombre_snapshot, cantidad,
                    precio_unitario_aplicado, subtotal )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const codigo = Array.isArray(data.access_codes) ? data.access_codes[0] : data.access_codes;

  return {
    id: data.id,
    numeroPedido: data.numero_pedido,
    clienteNombre: data.cliente_nombre,
    clienteWhatsapp: data.cliente_whatsapp,
    clienteCiudad: data.cliente_ciudad,
    total: data.total,
    estado: data.estado,
    notasAdmin: data.notas_admin,
    codigoUsado: codigo?.code ?? null,
    creadoEn: data.created_at,
    lineas: (data.order_items ?? []).map((l) => ({
      id: l.id,
      referencia: l.referencia_snapshot,
      nombre: l.nombre_snapshot,
      cantidad: l.cantidad,
      precioUnitarioAplicado: l.precio_unitario_aplicado,
      subtotal: l.subtotal,
    })),
  };
}
```

- [ ] **Step 2: Crear la pantalla de éxito**

Crear `src/app/pedido/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPedidoPorId } from "@/lib/data/orders";
import { obtenerConfiguracionPublica } from "@/lib/data/catalog";
import { pesos, enlaceWhatsApp } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pedido, config] = await Promise.all([
    obtenerPedidoPorId(id),
    obtenerConfiguracionPublica(),
  ]);

  if (!pedido) notFound();

  const mensajeWhatsApp =
    `¡Hola! Acabo de hacer mi pedido ${pedido.numeroPedido} ` +
    `a nombre de ${pedido.clienteNombre} por ${pesos(pedido.total)} 💕`;

  return (
    <main className="mx-auto max-w-md px-4 pb-32 text-center">
      <div className="pt-12 text-6xl">✨</div>

      <h1 className="pt-4 font-display text-3xl text-fucsia">
        {config.mensaje_exito ?? "¡Gracias por tu compra, princesa! ✨"}
      </h1>

      <p className="pt-2 text-sm text-carbon-suave">
        Guarda este número, es tu comprobante:
      </p>

      <p className="py-4 font-display text-5xl tracking-wide text-carbon">
        {pedido.numeroPedido}
      </p>

      <div className="space-y-2 rounded-tarjeta bg-petalo p-5 text-left shadow-petalo">
        <p className="text-sm">
          A nombre de <strong>{pedido.clienteNombre}</strong>
        </p>
        <p className="text-sm text-carbon-suave">{pedido.clienteCiudad}</p>

        <ul className="space-y-1 border-t border-rosa-nube pt-3">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex justify-between text-sm">
              <span className="pr-2">
                <span className="text-[11px] font-bold text-lila">{l.referencia}</span>{" "}
                {l.nombre} <span className="text-carbon-suave">x{l.cantidad}</span>
              </span>
              <span className="shrink-0 font-semibold">{pesos(l.subtotal)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-rosa-nube pt-3">
          <span className="font-display text-lg">Total</span>
          <span className="font-display text-xl text-fucsia">{pesos(pedido.total)}</span>
        </div>
      </div>

      {config.pago_numero && (
        <div className="mt-4 space-y-1 rounded-tarjeta bg-lila-suave/30 p-5">
          <p className="text-sm font-semibold text-carbon">Para completar tu pago</p>
          <p className="font-display text-2xl text-lila">{config.pago_metodo}</p>
          <p className="text-xl font-bold tracking-wide text-carbon">{config.pago_numero}</p>
          <p className="text-xs text-carbon-suave">a nombre de {config.pago_titular}</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <a href={enlaceWhatsApp(mensajeWhatsApp)} target="_blank" rel="noopener noreferrer">
          <Boton ancho>Enviar mi comprobante por WhatsApp</Boton>
        </a>
        <Link href="/">
          <Boton variante="fantasma" ancho>Seguir viendo el catálogo</Boton>
        </Link>
      </div>

      <p className="pt-8 text-xs text-carbon-suave">
        Anaya Beauty · Belleza que te define ♡
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Completar un pedido de prueba.
Expected: aparece el número de pedido en grande, el resumen con referencias, los datos de pago tomados de `store_settings` y el botón de WhatsApp con el mensaje ya escrito. Abrir un `uuid` inventado debe mostrar la página de "no encontrado".

- [ ] **Step 4: Verificar que llegó el correo**

Revisar la bandeja de `anayabeauty54@gmail.com`.
Expected: llegó el aviso con el número de pedido en el asunto. Si no llega, revisar `RESEND_API_KEY` y que la cuenta de Resend esté registrada con esa misma dirección.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pantalla de éxito con datos de pago y comprobante por WhatsApp"
```

---

## Task 13: Acceso al panel

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `crearClienteServidor`
- Produces: rutas bajo `/admin` protegidas; `iniciarSesion(estadoPrevio, datos: FormData)`; `cerrarSesion()`

- [ ] **Step 1: Crear el middleware de sesión**

Crear `src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (aGuardar) => {
          aGuardar.forEach(({ name, value }) => peticion.cookies.set(name, value));
          respuesta = NextResponse.next({ request: peticion });
          aGuardar.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const esRutaAdmin = peticion.nextUrl.pathname.startsWith("/admin");
  const esLogin = peticion.nextUrl.pathname === "/admin/login";

  if (esRutaAdmin && !esLogin && !user) {
    return NextResponse.redirect(new URL("/admin/login", peticion.url));
  }
  if (esLogin && user) {
    return NextResponse.redirect(new URL("/admin", peticion.url));
  }

  return respuesta;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Crear las acciones de sesión**

Crear `src/app/admin/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type ResultadoLogin = { error: string } | null;

export async function iniciarSesion(
  _previo: ResultadoLogin,
  datos: FormData
): Promise<ResultadoLogin> {
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(datos.get("correo") ?? "").trim(),
    password: String(datos.get("clave") ?? ""),
  });

  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 3: Crear la pantalla de acceso**

Crear `src/app/admin/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { iniciarSesion, type ResultadoLogin } from "./actions";
import { Boton } from "@/components/ui/Boton";

export default function PaginaLogin() {
  const [estado, accion, enviando] = useActionState<ResultadoLogin, FormData>(
    iniciarSesion,
    null
  );

  const campo =
    "w-full rounded-suave border-2 border-lila-suave bg-petalo px-4 py-3 outline-none focus:border-fucsia";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="pb-1 text-center font-display text-3xl text-fucsia">Anaya Beauty</h1>
      <p className="pb-8 text-center text-sm text-carbon-suave">Panel de administración</p>

      <form action={accion} className="space-y-4">
        <input name="correo" type="email" required placeholder="Correo" className={campo} />
        <input name="clave" type="password" required placeholder="Contraseña" className={campo} />

        {estado?.error && (
          <p className="rounded-suave bg-fucsia/10 p-3 text-center text-sm text-fucsia">
            {estado.error}
          </p>
        )}

        <Boton ancho type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Crear el layout del panel**

Crear `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import { cerrarSesion } from "./login/actions";

const enlaces = [
  { href: "/admin", texto: "Pedidos" },
  { href: "/admin/codigos", texto: "Códigos" },
  { href: "/admin/productos", texto: "Productos" },
  { href: "/admin/categorias", texto: "Categorías" },
  { href: "/admin/configuracion", texto: "Ajustes" },
  { href: "/admin/qr", texto: "QR" },
];

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rosa-nube">
      <header className="sticky top-0 z-20 border-b border-lila-suave bg-petalo">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-display text-lg text-fucsia">Anaya</span>

          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="whitespace-nowrap rounded-pastilla px-3 py-2 text-sm
                           font-semibold text-carbon-suave hover:bg-rosa-nube hover:text-fucsia"
              >
                {e.texto}
              </Link>
            ))}
          </nav>

          <form action={cerrarSesion}>
            <button className="whitespace-nowrap text-xs text-carbon-suave underline">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Crear los dos usuarios administradores**

En Supabase → Authentication → Users → **Add user** → *Create new user*, con "Auto Confirm User" activado. Crear uno para el propietario y otro para la administradora.

Importante: en Authentication → Providers → Email, **desactivar "Enable sign ups"**. Sin eso, cualquiera podría registrarse y las políticas para `authenticated` le darían acceso total al panel.

- [ ] **Step 6: Verificar la protección**

Abrir `http://localhost:3000/admin` sin sesión iniciada.
Expected: redirige a `/admin/login`. Tras iniciar sesión con un usuario válido, entra al panel. Con credenciales incorrectas, muestra el mensaje de error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): acceso protegido al panel con Supabase Auth"
```

---

## Task 14: Pedidos en vivo

La pantalla que la administradora deja abierta durante la transmisión.

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/TablaPedidos.tsx`, `src/app/admin/acciones-pedidos.ts`
- Modify: `src/lib/data/orders.ts` (añadir `listarPedidos`)

**Interfaces:**
- Consumes: `obtenerPedidoPorId`, `clienteAdmin`
- Produces:
  - `listarPedidos(filtro?: { estado?: EstadoPedido; busqueda?: string }): Promise<Pedido[]>`
  - `cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido): Promise<void>`

- [ ] **Step 1: Añadir la consulta de listado**

Primero, ampliar el import que ya está **al inicio** de `src/lib/data/orders.ts`:

```ts
import type { Pedido, EstadoPedido } from "@/lib/types";
```

Luego agregar al final del mismo archivo:

```ts
export async function listarPedidos(filtro?: {
  estado?: EstadoPedido;
  busqueda?: string;
}): Promise<Pedido[]> {
  const supabase = clienteAdmin();
  let consulta = supabase
    .from("orders")
    .select(`
      id, numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad,
      total, estado, notas_admin, created_at,
      access_codes ( code ),
      order_items ( id, referencia_snapshot, nombre_snapshot, cantidad,
                    precio_unitario_aplicado, subtotal )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtro?.estado) consulta = consulta.eq("estado", filtro.estado);

  if (filtro?.busqueda?.trim()) {
    const t = `%${filtro.busqueda.trim()}%`;
    consulta = consulta.or(
      `cliente_nombre.ilike.${t},numero_pedido.ilike.${t},cliente_whatsapp.ilike.${t}`
    );
  }

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  return (data ?? []).map((d) => {
    const codigo = Array.isArray(d.access_codes) ? d.access_codes[0] : d.access_codes;
    return {
      id: d.id,
      numeroPedido: d.numero_pedido,
      clienteNombre: d.cliente_nombre,
      clienteWhatsapp: d.cliente_whatsapp,
      clienteCiudad: d.cliente_ciudad,
      total: d.total,
      estado: d.estado as EstadoPedido,
      notasAdmin: d.notas_admin,
      codigoUsado: codigo?.code ?? null,
      creadoEn: d.created_at,
      lineas: (d.order_items ?? []).map((l) => ({
        id: l.id,
        referencia: l.referencia_snapshot,
        nombre: l.nombre_snapshot,
        cantidad: l.cantidad,
        precioUnitarioAplicado: l.precio_unitario_aplicado,
        subtotal: l.subtotal,
      })),
    };
  });
}
```

- [ ] **Step 2: Crear la acción de cambio de estado**

Crear `src/app/admin/acciones-pedidos.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoPedido } from "@/lib/types";

async function exigirSesion() {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
}

export async function cambiarEstadoPedido(pedidoId: string, estado: EstadoPedido) {
  await exigirSesion();
  const supabase = clienteAdmin();

  if (estado === "cancelado") {
    // Pasa por la función para que el stock vuelva al inventario.
    const { error } = await supabase.rpc("cancelar_pedido", { p_order_id: pedidoId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("orders").update({ estado }).eq("id", pedidoId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin");
}
```

- [ ] **Step 3: Crear la tabla de pedidos con actualización en vivo**

Crear `src/app/admin/TablaPedidos.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cambiarEstadoPedido } from "./acciones-pedidos";
import { pesos } from "@/lib/format";
import type { Pedido, EstadoPedido } from "@/lib/types";

const ESTADOS: EstadoPedido[] = ["nuevo", "pagado", "enviado", "cancelado"];

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "bg-fucsia/10 text-fucsia",
  pagado: "bg-lila-suave/50 text-lila",
  enviado: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};

export function TablaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);

  // Los pedidos nuevos entran solos: la administradora no refresca nada.
  useEffect(() => {
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel("pedidos-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [router]);

  if (pedidos.length === 0) {
    return <p className="py-16 text-center text-carbon-suave">Todavía no hay pedidos.</p>;
  }

  return (
    <ul className="space-y-3">
      {pedidos.map((p) => (
        <li key={p.id} className="rounded-tarjeta bg-petalo p-4 shadow-petalo">
          <button
            onClick={() => setAbierto(abierto === p.id ? null : p.id)}
            className="flex w-full items-start gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg">{p.numeroPedido}</p>
              <p className="text-sm font-semibold">{p.clienteNombre}</p>
              <p className="text-xs text-carbon-suave">
                {p.clienteWhatsapp} · {p.clienteCiudad}
                {p.codigoUsado && ` · código ${p.codigoUsado}`}
              </p>
              <p className="text-xs text-carbon-suave">
                {new Date(p.creadoEn).toLocaleString("es-CO")}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-bold text-fucsia">{pesos(p.total)}</p>
              <span className={`mt-1 inline-block rounded-pastilla px-3 py-1 text-xs font-bold ${COLOR_ESTADO[p.estado]}`}>
                {p.estado}
              </span>
            </div>
          </button>

          {abierto === p.id && (
            <div className="mt-3 space-y-3 border-t border-rosa-nube pt-3">
              <ul className="space-y-1">
                {p.lineas.map((l) => (
                  <li key={l.id} className="flex justify-between text-sm">
                    <span>
                      <span className="text-[11px] font-bold text-lila">{l.referencia}</span>{" "}
                      {l.nombre} <span className="text-carbon-suave">x{l.cantidad}</span>
                    </span>
                    <span className="font-semibold">{pesos(l.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== p.estado).map((e) => (
                  <button
                    key={e}
                    disabled={pendiente}
                    onClick={() =>
                      iniciarTransicion(async () => {
                        if (e === "cancelado" &&
                            !confirm("¿Cancelar este pedido? El stock volverá al inventario.")) return;
                        await cambiarEstadoPedido(p.id, e);
                        router.refresh();
                      })
                    }
                    className="rounded-pastilla border border-lila-suave px-4 py-2 text-xs
                               font-semibold hover:border-fucsia hover:text-fucsia disabled:opacity-40"
                  >
                    Marcar {e}
                  </button>
                ))}

                <a
                  href={`https://wa.me/57${p.clienteWhatsapp.replace(/\D/g, "").slice(-10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-pastilla bg-fucsia px-4 py-2 text-xs font-semibold text-petalo"
                >
                  Escribirle
                </a>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Crear la página de pedidos**

Crear `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { listarPedidos } from "@/lib/data/orders";
import { TablaPedidos } from "./TablaPedidos";
import { pesos } from "@/lib/format";
import type { EstadoPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTROS: (EstadoPedido | "todos")[] = ["todos", "nuevo", "pagado", "enviado", "cancelado"];

export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const filtros = await searchParams;
  const estado = filtros.estado as EstadoPedido | undefined;

  const pedidos = await listarPedidos({
    estado: estado && estado !== "todos" ? estado : undefined,
    busqueda: filtros.q,
  });

  const ventasDelDia = pedidos
    .filter(
      (p) =>
        p.estado !== "cancelado" &&
        new Date(p.creadoEn).toDateString() === new Date().toDateString()
    )
    .reduce((suma, p) => suma + p.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl">Pedidos</h1>
        <p className="text-sm text-carbon-suave">
          Hoy: <strong className="text-fucsia">{pesos(ventasDelDia)}</strong>
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={filtros.q ?? ""}
          placeholder="Buscar por nombre, número o WhatsApp…"
          className="flex-1 rounded-pastilla border-2 border-lila-suave bg-petalo px-4 py-2 text-sm outline-none focus:border-fucsia"
        />
        <button className="rounded-pastilla bg-fucsia px-5 text-sm font-semibold text-petalo">
          Buscar
        </button>
      </form>

      <nav className="flex gap-2 overflow-x-auto">
        {FILTROS.map((f) => (
          <Link
            key={f}
            href={f === "todos" ? "/admin" : `/admin?estado=${f}`}
            className={`whitespace-nowrap rounded-pastilla px-4 py-2 text-sm font-semibold
              ${(filtros.estado ?? "todos") === f ? "bg-fucsia text-petalo" : "bg-petalo text-carbon-suave"}`}
          >
            {f}
          </Link>
        ))}
      </nav>

      <TablaPedidos pedidos={pedidos} />
    </div>
  );
}
```

- [ ] **Step 5: Activar Realtime en Supabase**

En Supabase → Database → Replication → `supabase_realtime`, activar la tabla `orders`. Sin esto la lista no se actualiza sola.

- [ ] **Step 6: Verificar la actualización en vivo**

Con `/admin` abierto en una ventana, completar un pedido desde otra.
Expected: el pedido aparece en el panel sin recargar. Al desplegarlo se ven las líneas con referencias. Marcar "cancelado" devuelve el stock (verificar en la tabla `products`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): pedidos en vivo con cambio de estado y cancelación"
```

---

## Task 15: Generación de códigos

**Files:**
- Create: `src/app/admin/codigos/page.tsx`, `src/app/admin/codigos/PanelCodigos.tsx`, `src/app/admin/codigos/actions.ts`
- Create: `src/lib/data/codes.ts`

**Interfaces:**
- Consumes: `clienteAdmin`, `crearClienteServidor`
- Produces:
  - `listarCodigos(): Promise<Codigo[]>`
  - `generarCodigoNuevo(nota?: string): Promise<{ code: string; venceEn: string }>`
  - `anularCodigo(id: string): Promise<void>`

- [ ] **Step 1: Crear la capa de datos de códigos**

Crear `src/lib/data/codes.ts`:

```ts
import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Codigo } from "@/lib/types";

export async function listarCodigos(): Promise<Codigo[]> {
  const supabase = clienteAdmin();
  const { data, error } = await supabase
    .from("access_codes")
    .select("id, code, estado, vence_en, created_at, usado_en, nota, orders ( numero_pedido )")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`No se pudieron cargar los códigos: ${error.message}`);

  return (data ?? []).map((c) => {
    const pedido = Array.isArray(c.orders) ? c.orders[0] : c.orders;
    return {
      id: c.id,
      code: c.code,
      estado: c.estado,
      venceEn: c.vence_en,
      creadoEn: c.created_at,
      usadoEn: c.usado_en,
      numeroPedido: pedido?.numero_pedido ?? null,
      nota: c.nota,
    };
  });
}
```

- [ ] **Step 2: Crear las acciones de códigos**

Crear `src/app/admin/codigos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function generarCodigoNuevo(nota?: string) {
  // Se usa el cliente de sesión, no el de servicio: generar_codigo exige
  // auth.uid() para registrar quién creó el código.
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.rpc("generar_codigo", { p_nota: nota ?? null });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/codigos");
  return { code: data.code as string, venceEn: data.vence_en as string };
}

export async function anularCodigo(id: string) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("access_codes")
    .update({ estado: "anulado" })
    .eq("id", id)
    .eq("estado", "disponible");

  if (error) throw new Error(error.message);
  revalidatePath("/admin/codigos");
}
```

- [ ] **Step 3: Crear el panel de códigos**

Crear `src/app/admin/codigos/PanelCodigos.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarCodigoNuevo, anularCodigo } from "./actions";
import { Boton } from "@/components/ui/Boton";
import type { Codigo } from "@/lib/types";

export function PanelCodigos({ codigos }: { codigos: Codigo[] }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [reciente, setReciente] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const enlace = reciente ? `${sitio}/c/${reciente}` : "";

  const mensaje = reciente
    ? `¡Hola, preciosa! 💕 Ya confirmamos tu pago ✨\n\n` +
      `Tu código es: ${reciente}\n\n` +
      `Toca aquí y tu código se aplica solo:\n${enlace}\n\n` +
      `Ahí eliges todo lo que quieras y confirmas tu pedido. ¡Gracias por confiar en Anaya Beauty! ♡`
    : "";

  return (
    <div className="space-y-6">
      <Boton
        disabled={pendiente}
        onClick={() =>
          iniciarTransicion(async () => {
            const { code } = await generarCodigoNuevo();
            setReciente(code);
            setCopiado(false);
            router.refresh();
          })
        }
      >
        {pendiente ? "Generando…" : "Generar código nuevo"}
      </Boton>

      {reciente && (
        <div className="space-y-4 rounded-tarjeta bg-petalo p-6 shadow-flotante">
          <p className="text-center font-display text-6xl tracking-[0.3em] text-fucsia">
            {reciente}
          </p>

          <pre className="whitespace-pre-wrap rounded-suave bg-rosa-nube p-4 text-xs text-carbon">
            {mensaje}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              onClick={() => {
                navigator.clipboard.writeText(mensaje);
                setCopiado(true);
              }}
            >
              {copiado ? "¡Copiado! ✓" : "Copiar mensaje"}
            </Boton>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Boton>Abrir WhatsApp</Boton>
            </a>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {codigos.map((c) => {
          const vencido = c.estado === "disponible" && new Date(c.venceEn) < new Date();
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-suave bg-petalo px-4 py-3 shadow-petalo"
            >
              <span className="font-display text-2xl tracking-widest">{c.code}</span>

              <div className="min-w-0 flex-1 text-xs text-carbon-suave">
                <p>
                  {c.estado === "usado"
                    ? `Usado en ${c.numeroPedido}`
                    : vencido
                      ? "Vencido"
                      : `Vence ${new Date(c.venceEn).toLocaleString("es-CO")}`}
                </p>
              </div>

              {c.estado === "disponible" && !vencido && (
                <button
                  onClick={() => iniciarTransicion(async () => {
                    await anularCodigo(c.id);
                    router.refresh();
                  })}
                  className="text-xs text-carbon-suave underline"
                >
                  Anular
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Crear la página de códigos**

Crear `src/app/admin/codigos/page.tsx`:

```tsx
import { listarCodigos } from "@/lib/data/codes";
import { PanelCodigos } from "./PanelCodigos";

export const dynamic = "force-dynamic";

export default async function PaginaCodigos() {
  const codigos = await listarCodigos();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">Códigos</h1>
      <p className="text-sm text-carbon-suave">
        Genera un código cuando confirmes que la clienta te transfirió. El mensaje
        ya trae el link que aplica el código solo.
      </p>
      <PanelCodigos codigos={codigos} />
    </div>
  );
}
```

- [ ] **Step 5: Verificar el recorrido completo del código**

Generar un código, copiar el mensaje y abrir el link en una ventana privada con productos ya en el carrito.
Expected: el código aparece autorellenado en la confirmación. Tras confirmar, el listado marca ese código como "Usado en AB-XXXX".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): generación de códigos con mensaje y link listos para WhatsApp"
```

---

## Task 16: Gestión de productos

**Files:**
- Create: `src/app/admin/productos/page.tsx`, `src/app/admin/productos/[id]/page.tsx`, `src/app/admin/productos/FormularioProducto.tsx`, `src/app/admin/productos/actions.ts`

**Interfaces:**
- Consumes: `clienteAdmin`, `crearClienteServidor`
- Produces:
  - `guardarProducto(datos: FormData): Promise<{ error?: string }>`
  - `eliminarProducto(id: string): Promise<void>`
  - `subirImagen(archivo: File): Promise<string>`

- [ ] **Step 1: Crear el bucket de imágenes**

En Supabase → Storage → New bucket: nombre `productos`, marcado como **público**.

Luego, en el editor SQL, permitir que solo los usuarios del panel suban archivos:

```sql
drop policy if exists productos_lectura on storage.objects;
create policy productos_lectura on storage.objects
  for select to anon, authenticated using (bucket_id = 'productos');

drop policy if exists productos_escritura on storage.objects;
create policy productos_escritura on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists productos_borrado on storage.objects;
create policy productos_borrado on storage.objects
  for delete to authenticated using (bucket_id = 'productos');
```

- [ ] **Step 2: Crear las acciones de productos**

Crear `src/app/admin/productos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function subirImagen(archivo: File): Promise<string> {
  const supabase = await crearClienteServidor();
  const extension = archivo.name.split(".").pop() ?? "jpg";
  const ruta = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("productos").upload(ruta, archivo);
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
  return data.publicUrl;
}

export async function guardarProducto(datos: FormData): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();

  const id = String(datos.get("id") ?? "");
  const referencia = String(datos.get("referencia") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const stock = Number(datos.get("stock") ?? 0);
  const categoryId = String(datos.get("category_id") ?? "") || null;
  const descripcion = String(datos.get("descripcion") ?? "").trim() || null;
  const imagenPrincipal = String(datos.get("imagen_principal") ?? "") || null;
  const activo = datos.get("activo") === "on";

  if (!referencia || !nombre) return { error: "La referencia y el nombre son obligatorios." };
  if (!Number.isInteger(stock) || stock < 0) return { error: "El stock debe ser 0 o más." };

  // Los escalones llegan como pares paralelos min_cantidad[] / precio_unitario[]
  const minimos = datos.getAll("min_cantidad").map(Number);
  const precios = datos.getAll("precio_unitario").map(Number);

  const escalones = minimos
    .map((min, i) => ({ min_cantidad: min, precio_unitario: precios[i] }))
    .filter((e) => Number.isInteger(e.min_cantidad) && e.min_cantidad >= 1 && e.precio_unitario > 0);

  if (escalones.length === 0) {
    return { error: "Agrega al menos un precio (por ejemplo: desde 1 unidad)." };
  }
  if (!escalones.some((e) => e.min_cantidad === 1)) {
    return { error: "Falta el precio para 1 unidad: sin él no se puede cotizar una sola." };
  }

  const fila = {
    referencia,
    nombre,
    descripcion,
    category_id: categoryId,
    imagen_principal: imagenPrincipal,
    stock,
    activo,
  };

  let productoId = id;

  if (id) {
    const { error } = await supabase.from("products").update(fila).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("products").insert(fila).select("id").single();
    if (error) {
      return {
        error: error.message.includes("duplicate")
          ? `Ya existe un producto con la referencia ${referencia}.`
          : error.message,
      };
    }
    productoId = data.id;
  }

  // Se reemplazan todos los escalones: es más simple y seguro que diferenciarlos
  await supabase.from("price_tiers").delete().eq("product_id", productoId);
  const { error: errorEscalones } = await supabase
    .from("price_tiers")
    .insert(escalones.map((e) => ({ ...e, product_id: productoId })));

  if (errorEscalones) return { error: errorEscalones.message };

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return {};
}

export async function eliminarProducto(id: string) {
  const supabase = await crearClienteServidor();
  // Se desactiva en vez de borrar: los pedidos históricos lo siguen referenciando
  const { error } = await supabase.from("products").update({ activo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/productos");
  revalidatePath("/");
}
```

- [ ] **Step 3: Crear el formulario de producto**

Crear `src/app/admin/productos/FormularioProducto.tsx`. Puntos clave que debe cumplir:

- Campos: referencia, nombre, descripción, categoría (desplegable), stock, activo.
- Subida de imagen con vista previa, usando `subirImagen`; el resultado se guarda en un campo oculto `imagen_principal`.
- Sección de escalones: filas dinámicas con "desde N unidades" y "precio unitario"; botones para añadir y quitar filas; la primera fila arranca fija en `min_cantidad = 1`.
- Vista previa en vivo, calculada con `subtotalPara` de `@/lib/pricing`, mostrando lo que pagaría la clienta por 1, 3 y 6 unidades. Esto le permite a la administradora comprobar sus precios antes de guardar.
- Al enviar, llama a `guardarProducto` y muestra el mensaje de error si lo hay.

```tsx
// Estructura de las filas de escalones dentro del formulario:
{escalones.map((e, i) => (
  <div key={i} className="flex items-center gap-2">
    <span className="text-sm">desde</span>
    <input
      name="min_cantidad"
      type="number"
      min={1}
      value={e.minCantidad}
      readOnly={i === 0}
      onChange={(ev) => actualizarEscalon(i, "minCantidad", Number(ev.target.value))}
      className="w-20 rounded-suave border-2 border-lila-suave px-3 py-2"
    />
    <span className="text-sm">unds →</span>
    <input
      name="precio_unitario"
      type="number"
      min={1}
      value={e.precioUnitario}
      onChange={(ev) => actualizarEscalon(i, "precioUnitario", Number(ev.target.value))}
      className="w-32 rounded-suave border-2 border-lila-suave px-3 py-2"
    />
    <span className="text-sm">c/u</span>
    {i > 0 && (
      <button type="button" onClick={() => quitarEscalon(i)} className="text-xs underline">
        quitar
      </button>
    )}
  </div>
))}
```

- [ ] **Step 4: Crear el listado de productos**

Crear `src/app/admin/productos/page.tsx`: tabla con imagen en miniatura, referencia, nombre, categoría, stock y precio de 1 unidad; buscador por referencia o nombre; resaltado en fucsia de los productos con stock 0 o menor a 5; botón "Nuevo producto" y enlace a la importación por CSV.

- [ ] **Step 5: Verificar la gestión completa**

Crear un producto con referencia, imagen, stock 10 y escalones 1/10000, 3/9000, 6/8000.
Expected: aparece en el catálogo público con "desde $8.000"; su detalle calcula $27.000 para 3 unidades. Editar el stock a 2 hace que el catálogo muestre "Quedan 2" y el selector no pase de 2.

- [ ] **Step 6: Verificar la validación de escalones**

Intentar guardar un producto cuyo escalón más bajo empiece en 3.
Expected: error "Falta el precio para 1 unidad".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): gestión de productos con imágenes y escalones de precio"
```

---

## Task 17: Importación masiva por CSV

Con más de 150 productos, cargarlos uno por uno no es viable.

**Files:**
- Create: `src/app/admin/productos/importar/page.tsx`, `src/app/admin/productos/importar/actions.ts`
- Create: `src/lib/csv.ts`
- Create: `public/plantilla-productos.csv`
- Test: `src/lib/__tests__/csv.test.ts`

**Interfaces:**
- Produces:
  - `type FilaCSV = { referencia: string; nombre: string; descripcion: string; categoria: string; stock: number; escalones: { minCantidad: number; precioUnitario: number }[] }`
  - `parsearCSV(texto: string): { filas: FilaCSV[]; errores: string[] }`
  - `importarProductos(filas: FilaCSV[]): Promise<{ creados: number; actualizados: number; errores: string[] }>`

- [ ] **Step 1: Escribir las pruebas del análisis de CSV**

Crear `src/lib/__tests__/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsearCSV } from "@/lib/csv";

const cabecera = "referencia,nombre,descripcion,categoria,stock,precio_1,precio_3,precio_6";

describe("parsearCSV", () => {
  it("lee una fila completa con sus tres escalones", () => {
    const { filas, errores } = parsearCSV(
      `${cabecera}\nREF-101,Labial Rojo,Mate,Labiales,12,10000,9000,8000`
    );

    expect(errores).toEqual([]);
    expect(filas).toHaveLength(1);
    expect(filas[0].referencia).toBe("REF-101");
    expect(filas[0].stock).toBe(12);
    expect(filas[0].escalones).toEqual([
      { minCantidad: 1, precioUnitario: 10000 },
      { minCantidad: 3, precioUnitario: 9000 },
      { minCantidad: 6, precioUnitario: 8000 },
    ]);
  });

  it("acepta filas con un solo precio", () => {
    const { filas } = parsearCSV(`${cabecera}\nREF-200,Brocha,,Accesorios,5,15000,,`);
    expect(filas[0].escalones).toEqual([{ minCantidad: 1, precioUnitario: 15000 }]);
  });

  it("rechaza filas sin referencia y dice en qué línea", () => {
    const { filas, errores } = parsearCSV(`${cabecera}\n,Sin referencia,,Labiales,5,10000,,`);
    expect(filas).toHaveLength(0);
    expect(errores[0]).toContain("línea 2");
  });

  it("rechaza filas sin precio para 1 unidad", () => {
    const { errores } = parsearCSV(`${cabecera}\nREF-300,Rubor,,Rubores,5,,9000,`);
    expect(errores[0]).toContain("precio_1");
  });

  it("ignora líneas en blanco", () => {
    const { filas, errores } = parsearCSV(
      `${cabecera}\nREF-101,Labial,,Labiales,1,10000,,\n\n   \n`
    );
    expect(filas).toHaveLength(1);
    expect(errores).toEqual([]);
  });

  it("respeta las comas dentro de comillas", () => {
    const { filas } = parsearCSV(
      `${cabecera}\nREF-400,"Base mate, tono 2",Cobertura alta,Bases,3,35000,,`
    );
    expect(filas[0].nombre).toBe("Base mate, tono 2");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con "Failed to resolve import @/lib/csv".

- [ ] **Step 3: Implementar el análisis de CSV**

Crear `src/lib/csv.ts`:

```ts
export type FilaCSV = {
  referencia: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  stock: number;
  escalones: { minCantidad: number; precioUnitario: number }[];
};

/** Divide una línea respetando las comas que van dentro de comillas. */
function dividirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i];

    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === "," && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }

  campos.push(actual.trim());
  return campos;
}

export function parsearCSV(texto: string): { filas: FilaCSV[]; errores: string[] } {
  const lineas = texto.split(/\r?\n/);
  const filas: FilaCSV[] = [];
  const errores: string[] = [];

  // La primera línea es la cabecera; se salta
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea.trim()) continue;

    const numeroLinea = i + 1;
    const [referencia, nombre, descripcion, categoria, stock, p1, p3, p6] = dividirLinea(linea);

    if (!referencia) {
      errores.push(`línea ${numeroLinea}: falta la referencia`);
      continue;
    }
    if (!nombre) {
      errores.push(`línea ${numeroLinea}: falta el nombre`);
      continue;
    }
    if (!p1 || Number(p1) <= 0) {
      errores.push(`línea ${numeroLinea} (${referencia}): falta precio_1, el precio de 1 unidad`);
      continue;
    }

    const escalones = [{ minCantidad: 1, precioUnitario: Number(p1) }];
    if (p3 && Number(p3) > 0) escalones.push({ minCantidad: 3, precioUnitario: Number(p3) });
    if (p6 && Number(p6) > 0) escalones.push({ minCantidad: 6, precioUnitario: Number(p6) });

    filas.push({
      referencia: referencia.toUpperCase(),
      nombre,
      descripcion: descripcion ?? "",
      categoria: categoria ?? "",
      stock: Number(stock) || 0,
      escalones,
    });
  }

  return { filas, errores };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test`
Expected: PASS, las seis pruebas de CSV.

- [ ] **Step 5: Crear la acción de importación**

Crear `src/app/admin/productos/importar/actions.ts`. Comportamiento requerido:

- Recibe `FilaCSV[]`.
- Para cada fila: si la categoría no existe, la crea (el `slug` se genera a partir del nombre en minúsculas, sin tildes y con guiones).
- Inserta el producto, o lo actualiza si ya existe esa referencia (`upsert` sobre `referencia`).
- Reemplaza los escalones del producto.
- Devuelve el conteo de creados y actualizados, y la lista de errores por fila.
- Procesa en lotes de 50 para no agotar el tiempo de la petición con 150 o más productos.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { FilaCSV } from "@/lib/csv";

function generarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function importarProductos(filas: FilaCSV[]) {
  const supabase = await crearClienteServidor();
  const errores: string[] = [];
  let creados = 0;
  let actualizados = 0;

  // Las categorías se resuelven una sola vez, no fila por fila
  const nombresCategoria = [...new Set(filas.map((f) => f.categoria).filter(Boolean))];
  const mapaCategorias = new Map<string, string>();

  for (const nombre of nombresCategoria) {
    const slug = generarSlug(nombre);
    const { data } = await supabase
      .from("categories")
      .upsert({ nombre, slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (data) mapaCategorias.set(nombre, data.id);
  }

  for (const fila of filas) {
    const { data: existente } = await supabase
      .from("products")
      .select("id")
      .eq("referencia", fila.referencia)
      .maybeSingle();

    const { data: producto, error } = await supabase
      .from("products")
      .upsert(
        {
          referencia: fila.referencia,
          nombre: fila.nombre,
          descripcion: fila.descripcion || null,
          category_id: mapaCategorias.get(fila.categoria) ?? null,
          stock: fila.stock,
          activo: true,
        },
        { onConflict: "referencia" }
      )
      .select("id")
      .single();

    if (error || !producto) {
      errores.push(`${fila.referencia}: ${error?.message ?? "no se pudo guardar"}`);
      continue;
    }

    await supabase.from("price_tiers").delete().eq("product_id", producto.id);
    await supabase.from("price_tiers").insert(
      fila.escalones.map((e) => ({
        product_id: producto.id,
        min_cantidad: e.minCantidad,
        precio_unitario: e.precioUnitario,
      }))
    );

    if (existente) actualizados++;
    else creados++;
  }

  revalidatePath("/admin/productos");
  revalidatePath("/");
  return { creados, actualizados, errores };
}
```

- [ ] **Step 6: Crear la plantilla y la pantalla de importación**

Crear `public/plantilla-productos.csv`:

```csv
referencia,nombre,descripcion,categoria,stock,precio_1,precio_3,precio_6
REF-101,Labial Rojo Pasión,Mate de larga duración,Labiales,12,10000,9000,8000
REF-233,Rubor Durazno,Acabado natural,Rubores,8,12000,11000,
REF-410,Base Mate Natural,Cobertura alta,Bases,5,35000,,
```

Crear `src/app/admin/productos/importar/page.tsx`: campo de archivo que lee el CSV, muestra una vista previa con los productos detectados y los errores por línea, y un botón de confirmación que llama a `importarProductos` y presenta el resumen final. Debe incluir un enlace de descarga a `/plantilla-productos.csv` y una nota explicando que `precio_3` y `precio_6` pueden ir vacíos.

- [ ] **Step 7: Verificar con la plantilla**

Importar `plantilla-productos.csv`.
Expected: reporta 3 creados, 0 actualizados, sin errores. Los tres productos aparecen en el catálogo con sus precios correctos. Volver a importar el mismo archivo reporta 0 creados y 3 actualizados, sin duplicar nada.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(admin): importación masiva de productos por CSV"
```

---

## Task 18: Categorías, configuración y código QR

**Files:**
- Create: `src/app/admin/categorias/page.tsx`, `src/app/admin/categorias/actions.ts`
- Create: `src/app/admin/configuracion/page.tsx`, `src/app/admin/configuracion/actions.ts`
- Create: `src/app/admin/qr/page.tsx`, `src/app/admin/qr/GeneradorQR.tsx`

**Interfaces:**
- Produces:
  - `guardarCategoria(datos: FormData)`, `eliminarCategoria(id: string)`
  - `guardarConfiguracion(datos: FormData)`

- [ ] **Step 1: Crear la gestión de categorías**

`src/app/admin/categorias/page.tsx` con: listado de categorías principales y sus subcategorías anidadas, formulario para crear (nombre, categoría padre opcional, orden), edición en línea del nombre y el orden, y desactivación. El `slug` se genera automáticamente con la misma función `generarSlug` de la Task 17 — extraerla a `src/lib/slug.ts` y reutilizarla en ambos sitios en vez de duplicarla.

- [ ] **Step 2: Crear la pantalla de configuración**

`src/app/admin/configuracion/page.tsx`: formulario que lee y escribe `store_settings` con estos campos:

| Clave | Etiqueta | Ayuda |
|---|---|---|
| `pago_metodo` | Método de pago | Nequi, Daviplata, Bancolombia… |
| `pago_numero` | Número o cuenta | Se muestra a la clienta al terminar |
| `pago_titular` | A nombre de | |
| `whatsapp_negocio` | WhatsApp | Formato 573132553660 |
| `mensaje_exito` | Mensaje de agradecimiento | Aparece al confirmar el pedido |
| `horas_vigencia_codigo` | Horas que dura un código | Por defecto 24 |

La acción `guardarConfiguracion` hace `upsert` de cada clave y llama a `revalidatePath("/")` para que los cambios se vean de inmediato.

- [ ] **Step 3: Crear el generador de código QR**

Crear `src/app/admin/qr/GeneradorQR.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Boton } from "@/components/ui/Boton";

export function GeneradorQR({ url }: { url: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!lienzo.current) return;
    QRCode.toCanvas(lienzo.current, url, {
      width: 1024,
      margin: 2,
      color: { dark: "#E5308A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then(() => setListo(true));
  }, [url]);

  function descargar() {
    const enlace = document.createElement("a");
    enlace.download = "anaya-beauty-qr.png";
    enlace.href = lienzo.current!.toDataURL("image/png");
    enlace.click();
  }

  return (
    <div className="space-y-4 text-center">
      <div className="inline-block rounded-tarjeta bg-petalo p-6 shadow-petalo">
        <canvas ref={lienzo} className="h-64 w-64" />
      </div>
      <p className="text-sm text-carbon-suave">{url}</p>
      <Boton onClick={descargar} disabled={!listo}>
        Descargar QR en alta resolución
      </Boton>
    </div>
  );
}
```

Crear `src/app/admin/qr/page.tsx` que renderice `<GeneradorQR url={process.env.NEXT_PUBLIC_SITE_URL!} />` con instrucciones para usarlo en las transmisiones.

- [ ] **Step 4: Verificar**

Cambiar el número de pago en configuración.
Expected: la pantalla de éxito de un pedido nuevo muestra el número actualizado. El QR descargado, escaneado con un celular, abre el catálogo.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): categorías, configuración editable y generador de QR"
```

---

## Task 19: Publicación y guía de puesta en marcha

**Files:**
- Create: `SETUP.md`
- Create: `README.md`
- Modify: `.env.example` (si faltara alguna variable)

- [ ] **Step 1: Escribir la guía de puesta en marcha**

Crear `SETUP.md` con estos pasos, redactados para alguien sin conocimientos técnicos:

1. **Supabase** — crear cuenta y proyecto; guardar la contraseña de la base de datos; ejecutar en el editor SQL, en orden, `supabase/schema.sql`, `policies.sql`, `functions.sql` y `tests.sql`; confirmar que aparece "TODAS LAS PRUEBAS PASARON"; crear el bucket público `productos` y aplicar sus políticas; activar Realtime para la tabla `orders`; crear los dos usuarios en Authentication con "Auto Confirm" y **desactivar el registro abierto**; copiar la URL del proyecto, la clave `anon` y la clave `service_role`.
2. **Resend** — crear la cuenta **con `anayabeauty54@gmail.com`**, generar una API key y copiarla. Advertir que el plan gratuito solo envía a esa dirección y que el límite es de 100 correos diarios.
3. **GitHub** — subir el repositorio.
4. **Vercel** — importar el repositorio, definir las variables de entorno (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CORREO_DESTINO`, `SAL_HASH_IP`), publicar y fijar el nombre `anayabeauty` para obtener `anayabeauty.vercel.app`. Recordar volver a `NEXT_PUBLIC_SITE_URL` con la dirección definitiva y volver a publicar.
5. **Primer uso** — entrar al panel, configurar los datos de pago, importar los productos por CSV, descargar el QR.
6. **Rutina de cada transmisión** — abrir `/admin` en un lado y `/admin/codigos` en el otro; por cada clienta que transfiera, generar un código y enviarle el mensaje con el link; ver los pedidos entrar solos; al final del live, marcar los pagados y despachar.

Incluir una sección de "Qué hacer si algo falla" con los tres casos más probables: no llegan los correos (revisar que la cuenta de Resend use ese correo y que no se hayan superado los 100 diarios), un código no funciona (revisar si venció o ya fue usado en la pantalla de códigos), y el stock quedó mal (cancelar el pedido correspondiente para devolverlo).

- [ ] **Step 2: Escribir el README técnico**

Crear `README.md` con: qué es el proyecto, el stack, cómo levantarlo en local, cómo correr las pruebas, la estructura de carpetas, y un enlace a `SETUP.md` y al spec.

- [ ] **Step 3: Verificar la compilación de producción**

Run: `npm run build`
Expected: compila sin errores ni advertencias de tipos.

- [ ] **Step 4: Ejecutar toda la batería de pruebas**

Run: `npm test`
Expected: PASS en todas las pruebas: precios, formato, mapeo del catálogo, carrito, panel de compra, plantilla de correo y CSV.

- [ ] **Step 5: Verificar el recorrido completo en producción**

Tras publicar en Vercel: escanear el QR con un celular, armar un pedido, generar un código desde el panel, abrir el link desde WhatsApp, confirmar el pedido.
Expected: el pedido aparece en el panel en vivo, llega el correo a `anayabeauty54@gmail.com`, el stock baja y el código queda quemado.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: guía de puesta en marcha y README"
```

---

## Verificación final

Antes de dar el proyecto por terminado, confirmar con evidencia:

- [ ] `npm test` pasa por completo
- [ ] `npm run build` compila sin errores
- [ ] `supabase/tests.sql` reporta las nueve pruebas en verde
- [ ] Con el rol `anon`, `select * from access_codes` no devuelve filas
- [ ] Un código usado dos veces es rechazado la segunda vez
- [ ] Cancelar un pedido devuelve el stock exacto
- [ ] El correo llega a `anayabeauty54@gmail.com`
- [ ] El QR abre el catálogo desde un celular real
- [ ] El catálogo se ve correctamente en una pantalla de 360 px sin desplazamiento horizontal




