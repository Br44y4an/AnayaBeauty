# Rediseño del catálogo Anaya Beauty (v5) — plan de implementación

> **Para agentes:** este plan se ejecuta con un workflow de subagentes por oleadas (equivalente a
> superpowers:subagent-driven-development, con revisión por tarea y revisión final de la rama). Los pasos usan casillas
> (`- [ ]`). Cada agente trabaja SOLO en los archivos de su tarea; el orquestador hace los commits al cerrar cada oleada.

**Meta:** que elegir productos (incluidos varios tonos) y pedir sea obvio en el celular, con una tienda de aspecto
profesional, código limpio y una base segura.

**Arquitectura:** Next 16 App Router con un grupo `(tienda)` (cabecera, pie, avisos), ficha como vista rápida por ruta
interceptada `@modal/(.)producto/[referencia]`, lecturas públicas con un cliente Supabase sin cookies + `unstable_cache`
con etiquetas, lecturas del cliente por GET (`/api/catalogo`, `/api/buscar`, `/api/bolsa`) y un único Server Action
público (`confirmarPedido`). Base: migración v5 compatible con la web vieja.

**Stack:** Next.js 16.3.2, React 19.2.8, TypeScript, Tailwind 4 (`@theme`), Supabase JS 2.112 + @supabase/ssr, Zustand 5,
Vitest 4 + Testing Library, Resend, jsPDF.

**Spec:** `docs/superpowers/specs/2026-11-10-rediseno-catalogo-design.md` (léelo completo antes de empezar; este plan
argumenta desde él).

## Restricciones globales

- Antes de usar cualquier API de Next, lee su página en `node_modules/next/dist/docs/` (AGENTS.md). No asumas Next 14/15.
- Sin dependencias nuevas (ni de ejecución ni de desarrollo).
- Textos en español de Colombia, tuteo, frases cortas, **cero emoji**, sin «princesa» ni apodos, **una sola exclamación**
  en todo el recorrido («¡Pedido confirmado!»). Vocabulario fijo: «bolsa» antes de confirmar y «pedido» después; «Ref.»;
  «c/u»; la etiqueta de variante del producto («tono», «color», «diseño»…). Dinero con `pesos()` ($8.000); «5 %».
- Colores solo por tokens nuevos (§5 del spec). `acento` (#d11a72) solo para el relleno de la acción principal, el
  contador de la bolsa y el anillo de foco. Nunca texto sobre tintes translúcidos de marca.
- Accesibilidad: inputs ≥16 px, objetivos ≥44 px, AA, etiquetas visibles, foco visible, `aria-describedby` en errores.
- Comentarios de 3 líneas como máximo y solo para invariantes no evidentes. Nada de `<a><button>`. Ningún componente
  nuevo de más de ~250 líneas.
- La base es la de PRODUCCIÓN. Nadie pulsa «Confirmar pedido», nadie ejecuta `scripts/probar-*.mjs`, nadie escribe en la
  base salvo la Tarea 1. Las capturas con `cdp.mjs` (`C:\Users\Brayan\AppData\Local\Temp\claude\c4f901e614d65603\4f5f8714-b889-4714-9ae0-ed67ee592183\scratchpad\cdp.mjs`)
  pueden agregar a la bolsa, nunca confirmar.
- El servidor de desarrollo ya corre en `http://localhost:3000` y es compartido: no lo detengas ni arranques otro. No
  ejecutes `next build` en las oleadas 1 y 2 (lo hace la integración).
- Ningún agente ejecuta comandos de git que cambien estado (commit, checkout, stash, reset, rebase).
- Si necesitas un cambio en un archivo que no es tuyo, no lo hagas: anótalo en tu informe final («Necesito en X: …»).
- `npx tsc --noEmit` revisa todo el proyecto: en las oleadas paralelas ignora los errores de archivos ajenos (otros
  agentes están a mitad de camino), pero los tuyos deben quedar limpios según las interfaces de este plan.
- Pruebas: Vitest con entorno `node` por defecto; los archivos de prueba de componentes empiezan con
  `// @vitest-environment jsdom`.

## Foco de revisión

1. **Referencias con caracteres raros** («AC80/150», «100%», espacios): tarjeta, modal, ficha, sugerencias y bolsa deben
   ir y volver con `encodeURIComponent` y decodificar una sola vez; un `%` suelto no puede tirar la página (Tarea 3:
   pruebas de `rutaProducto`/`decodificarReferencia`; Tarea 6, Paso 4: `/producto/100%25` y `/producto/%E0%A4%A` →
   404, nunca 500).
2. **Doble toque al cerrar** el modal o la búsqueda (público mayor de 40): un segundo toque no puede ejecutar otro
   `history.back()` y sacar a la clienta de la tienda (Tarea 6: prueba de `ModalProducto`; Tarea 2: prueba de
   `useHistorialHoja`).
3. **Bolsas guardadas por la v4**: líneas cuyo `tonoId` ya no existe (el panel viejo regeneraba ids) o cuyo tono se
   borró deben recuperarse por nombre o marcarse «no disponible», nunca romper (Tarea 3: `reconciliarCarrito`).
4. **Dos pestañas** (enlace de WhatsApp abierto aparte): agregar en una no puede borrar lo de la otra (Tarea 3: prueba de
   `escucharOtrasPestanas`; Tarea 4 lo monta).
5. **Configuración incompleta** (sin reglas, sin `envio_info`, sin `whatsapp_negocio`, sin datos de pago): ninguna página
   muestra «undefined», «NaN» ni secciones vacías (Tarea 3: `mapearConfiguracion` con filas vacías; Tarea 4:
   `BarraBeneficios` sin reglas no pinta nada; Tarea 7: pedido sin datos de pago muestra «Te enviamos los datos de pago
   por WhatsApp»).

---

## Oleada 1 (en paralelo): Tareas 1, 2 y 3

### Tarea 1: Base de datos v5

**Archivos:**
- Crear: `supabase/migracion-v5.sql`, `supabase/migracion-v5-departamentos.sql`, `supabase/revertir-v5.sql`,
  `supabase/tests-v5.sql`
- Modificar: `supabase/README.md`

**Interfaces que produce** (las usa la Tarea 3 y el panel):
- `public.normalizar(t text) returns text` (immutable, parallel safe).
- `public.buscar_productos(p_grupos text[], p_categorias uuid[] default null) returns setof public.products` (stable,
  security invoker; grant a anon y authenticated). Cada elemento de `p_grupos` es «alt1|alt2|…»; un producto activo
  coincide si para cada grupo alguna alternativa aparece en el texto normalizado (nombre, referencia, descripción,
  categoría, categoría madre, nombres de variantes) o en `regexp_replace(normalizar(referencia),'[^a-z0-9]','','g')`.
- `public.es_admin() returns boolean`; `public.cambiar_estado_pedido(p_order_id uuid, p_estado text) returns void`
  (solo service_role; lanza `TRANSICION_INVALIDA`).
- Columnas: `categories.etiqueta_variante`, `products.destacado`, `products.etiqueta_variante`,
  `product_shades.agotado`, `orders.politica_version`, `orders.politica_aceptada_en`. Ajuste `envio_info` (público).

- [ ] **Paso 1: Leer el estado real.** `supabase/functions.sql`, `migracion-v4.sql` (crear/cancelar pedido),
  `policies.sql` y, con SELECT por el MCP de Supabase (proyecto `xvqqeedtdpqlfaaicymz`): `pg_policies` de `public` y
  `storage`, `pg_publication_tables`, definición actual de `cancelar_pedido` (`pg_get_functiondef`).
- [ ] **Paso 2: Escribir `tests-v5.sql`** (empieza con `begin;`, termina con `rollback;`, cada caso en un `do $$` que
  lanza excepción si falla, y un `raise notice 'TODAS LAS PRUEBAS V5 PASARON'` al final). Usa datos de prueba creados
  dentro de la transacción (categoría madre + hija, productos «USK-621 Paleta», «Pestañas postizas 3D», «Brocha para
  polvo», «Pestañina waterproof», tonos):
  - `buscar_productos(array['usk621'])`, `array['usk','621']`, `array['pestana']`, `array['brocha','polvo']` y
    `array['rimel|mascara|pestanina']` devuelven el producto esperado; `p_categorias` con el id de la madre restringe.
  - Insertar una nieta (hija de una hija) falla con `CATEGORIA_PROFUNDIDAD`; una categoría con padre = sí misma falla.
  - `es_admin()` es false sin sesión.
  - Pedido de prueba con dos líneas del mismo producto (tonos distintos, 2 y 3 unidades): `cancelar_pedido` devuelve 5
    unidades al stock; llamarlo dos veces no devuelve 10.
  - `cambiar_estado_pedido`: nuevo→pagado ok; pagado→enviado ok; cancelado→nuevo lanza `TRANSICION_INVALIDA`.
  - `orders` está en la publicación `supabase_realtime`.
- [ ] **Paso 3: Escribir `migracion-v5.sql`** según §9.1 del spec, idempotente (`if not exists`, `create or replace`,
  `drop policy if exists`). Check de etiqueta: `in ('Tono','Color','Diseño','Modelo','Aroma','Largo','Paleta')`.
  `administradores` con las cuentas actuales de `auth.users`. Reemplazar las políticas `*_admin` y las de escritura del
  bucket `productos` (insert/update/delete) por `es_admin()`. `envio_info` = «El envío se coordina por WhatsApp después de
  confirmar tu pedido.» `mensaje_exito` → «Gracias por comprar en Anaya Beauty.» solo si contiene «princesa».
- [ ] **Paso 4: Aplicar** con `mcp__supabase__apply_migration` (nombre `v5_rediseno`) y **ejecutar** `tests-v5.sql` con
  `execute_sql`. Esperado: el aviso de éxito y ningún cambio persistente (rollback).
- [ ] **Paso 5: Escribir `migracion-v5-departamentos.sql`** (§9.2; NO se aplica ahora) y probarla dentro de
  `begin; … select …; rollback;`: 7 madres, 26 hijas activas con padre, ninguna inactiva tocada.
- [ ] **Paso 6: Escribir `revertir-v5.sql`** (deja hijas sin padre y borra las 7 madres; no revierte la seguridad ni las
  columnas, que son compatibles con la web vieja) y actualizar `supabase/README.md` (orden v5, Realtime ya incluido,
  advertencia de desactivar el registro).
- [ ] **Paso 7: Verificar con SELECT:** las políticas nuevas en `pg_policies`, `administradores` con 2 filas,
  `get_advisors` de seguridad sin nuevos avisos críticos. Entregar resumen.

### Tarea 2: Base visual y componentes de interfaz

**Archivos:**
- Modificar: `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/__tests__/contraste.test.ts`,
  `src/components/ui/{Boton,Iconos,Esqueleto,Insignia,Hoja,VisorImagen}.tsx`
- Crear: `src/components/ui/{Giro,Campo,Stepper,Avisos,Marca}.tsx`, `src/lib/avisos.ts`,
  `src/hooks/{useBloquearScroll,useHistorialHoja}.ts`, `src/app/@modal/default.tsx`, `scripts/generar-marca.mjs`,
  `public/marca/anaya-beauty.png`, `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt`
- Pruebas: `src/components/ui/__tests__/{Stepper,Avisos,Boton,Hoja}.test.tsx`, `src/hooks/__tests__/useHistorialHoja.test.tsx`,
  `src/lib/__tests__/avisos.test.ts`
- Regla de compatibilidad: todo export y prop que hoy existe en `src/components/ui/*` sigue funcionando (otros archivos
  aún los usan); puedes añadir y reestilizar. Los alias se borran en la integración.

**Interfaces que produce:**
```ts
// Boton.tsx
type VarianteBoton = "primario" | "secundario" | "contorno" | "fantasma" | "peligro";
type TamanoBoton = "compacto" | "normal" | "grande"; // 44 / 52 / 56 px de alto
export function estilosBoton(o?: { variante?: VarianteBoton; tamano?: TamanoBoton; ancho?: boolean; className?: string }): string;
export function Boton(p: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton; tamano?: TamanoBoton; ancho?: boolean; cargando?: boolean }): JSX.Element;
export function BotonEnlace(p: ComponentProps<typeof Link> & { variante?: VarianteBoton; tamano?: TamanoBoton; ancho?: boolean }): JSX.Element;
// Giro.tsx
export function Giro(p: { className?: string; etiqueta?: string }): JSX.Element;
// Iconos.tsx (24×24, trazo 1.75, currentColor, aria-hidden): IconoBuscar, IconoBolsa, IconoCerrar, IconoAtras,
// IconoChevron ({ direccion?: "abajo"|"arriba"|"izquierda"|"derecha" }), IconoMas, IconoMenos, IconoEliminar, IconoCheck,
// IconoCopiar, IconoCompartir, IconoAlerta, IconoInfo, IconoWhatsApp — props SVGProps<SVGSVGElement> & { tamano?: number }
// Campo.tsx
export function Campo(p: InputHTMLAttributes<HTMLInputElement> & { id: string; etiqueta: string; ayuda?: string; error?: string | null }): JSX.Element;
// Stepper.tsx — botones de 44 px, valor en <output>
export function Stepper(p: { valor: number; min?: number; max: number; onCambiar: (n: number) => void; etiqueta: string; tamano?: "compacto" | "normal"; deshabilitado?: boolean }): JSX.Element;
// Hoja.tsx — diálogo modal: abajo en celular, centrado desde 768 px
export function Hoja(p: { abierta: boolean; alCerrar: () => void; titulo: string; tituloVisible?: boolean; pie?: ReactNode; children: ReactNode; ancho?: "normal" | "amplio"; pantallaCompleta?: boolean }): JSX.Element | null;
// VisorImagen.tsx — pantalla completa, doble toque y pellizco hasta 2×, Escape, foco en Cerrar
export function VisorImagen(p: { src: string; alt: string; abierto: boolean; alCerrar: () => void }): JSX.Element | null;
// src/lib/avisos.ts
export type Aviso = { id: number; titulo: string; detalle?: string; imagen?: string | null; accion?: { etiqueta: string; href?: string; alHacer?: () => void } };
export function mostrarAviso(a: Omit<Aviso, "id">): void; // reemplaza el actual; se cierra solo a los 5000 ms
export function cerrarAviso(): void;
export function useAvisoActual(): Aviso | null;
// Avisos.tsx — role="status", abajo sobre el área segura; se eleva por encima de un pie fijo usando la variable CSS --alto-pie-fijo
export function Avisos(): JSX.Element;
// Marca.tsx — enlace a "/" con el logotipo; aria-label "Anaya Beauty, inicio"
export function Marca(p: { className?: string; tamano?: "normal" | "pequena" }): JSX.Element;
// Esqueleto.tsx: Esqueleto({ className }), EsqueletoTarjeta(), EsqueletoGrilla({ cantidad?: number })
// Insignia.tsx: Insignia({ tono: "neutro" | "alerta" | "ahorro" | "error"; children })
// hooks
export function useBloquearScroll(activo: boolean): void; // html[data-bloqueo-scroll]
export function useHistorialHoja(abierta: boolean, alCerrar: () => void): { cerrar: () => void }; // pushState al abrir; popstate cierra; cerrar() hace un único history.back()
// layout.tsx
export default function RootLayout(p: { children: ReactNode; modal: ReactNode }): JSX.Element; // pinta {children}{modal}
// @modal/default.tsx → export default function Default() { return null }
```

- [ ] **Paso 1: Escribir las pruebas que fallan**
  - `contraste.test.ts` (reescrita con los tokens nuevos de §5): ≥4,5 para tinta/fondo, tinta-suave sobre fondo,
    superficie e inactivo, firma sobre fondo y superficie, acento sobre fondo, blanco sobre acento y acento-hondo, ahorro
    sobre fondo y ahorro-fondo, alerta sobre alerta-fondo, error sobre error-fondo; ≥3 para borde sobre fondo y
    superficie; y que `#e5308a` y `#a97fd0` no aparezcan como valor de ningún token.
  - `avisos.test.ts`: `mostrarAviso` deja el aviso actual; un segundo reemplaza al primero; `cerrarAviso` lo limpia; con
    `vi.useFakeTimers()` a los 5000 ms queda `null`.
  - `Stepper.test.tsx`: `getByRole("button", { name: "Agregar uno de Tono 3" })` llama `onCambiar(valor+1)`; en `max` ese
    botón tiene `disabled`; en `min` el de quitar también; el valor se lee en `getByRole("status")` o `<output>`.
  - `Avisos.test.tsx`: muestra título y la acción «Ver bolsa» como enlace con `href="/carrito"`; una acción con
    `alHacer` lo llama y cierra el aviso.
  - `Boton.test.tsx`: `BotonEnlace` produce un `<a>` sin `<button>` adentro; `cargando` pone `aria-busy="true"` y
    `disabled`.
  - `Hoja.test.tsx`: abrir mueve el foco dentro; Escape llama `alCerrar` una vez.
  - `useHistorialHoja.test.tsx`: al abrir hace `pushState`; `cerrar()` llamado dos veces ejecuta `history.back` una sola
    vez; un `popstate` llama `alCerrar`.
- [ ] **Paso 2: Correr** `npx vitest run src/components/ui src/hooks src/lib/__tests__/contraste.test.ts src/lib/__tests__/avisos.test.ts` → FALLAN.
- [ ] **Paso 3: Tokens y base** en `globals.css`: tokens §5, radios (`--radius-sm` 4px, `--radius-md` 8px,
  `--radius-lg` 16px), sombras `--shadow-flotante` y `--shadow-hoja`, animaciones (`subir`, `aparecer`, `pulso`), alias
  temporales listados en §5 (incluidos `--radius-suave/tarjeta/pastilla`, `--shadow-petalo` → `none`, `--font-display` →
  la sans), `:focus-visible` (anillo acento 2 px, separación 2 px), `html[data-bloqueo-scroll]{overflow:hidden}`,
  `scroll-padding-top: 6.5rem`, `.margen-seguro`, `.salto-contenido`, bloque `prefers-reduced-motion`. Se va la regla
  serif de h1–h3.
- [ ] **Paso 4: `layout.tsx`**: Figtree (`next/font/google`, variable `--fuente-figtree`, subsets latin), metadata
  (`title: { default: "Anaya Beauty — Maquillaje y accesorios", template: "%s · Anaya Beauty" }`, descripción corta,
  `metadataBase` desde `NEXT_PUBLIC_SITE_URL`), viewport (`themeColor "#ffffff"`, `maximumScale 5`), body con fondo y
  tinta; recibe `modal` y pinta `{children}{modal}`; quita `BotonFlotante`. Crear `@modal/default.tsx`.
- [ ] **Paso 5: Componentes** con las interfaces de arriba. `Hoja` y `VisorImagen` con callbacks estables
  (`useEffectEvent` de React 19.2) para no repetir el efecto en cada render; animación de entrada 220 ms y salida 160 ms.
- [ ] **Paso 6: Marca y OG.** `scripts/generar-marca.mjs` (sharp, ya es devDependency) recorta de `logo.jpeg` (1254×1254)
  la zona de «Anaya» + «BEAUTY» (aprox. x 90–1085, y 395–880), blanquea los trozos del círculo y de la rama que queden
  dentro (sin tocar letras), vuelve transparente el blanco, recorta bordes y exporta `public/marca/anaya-beauty.png` con
  ~160 px de alto. Mira el PNG resultante (Read) sobre fondo blanco y sobre gris: si quedan restos, ajusta; si no se puede
  limpiar, aplica la alternativa del spec §5. `opengraph-image.png` 1200×630: logo completo centrado sobre blanco.
- [ ] **Paso 7: Correr** las pruebas del Paso 2 → PASAN. `npx tsc --noEmit` sin errores en tus archivos.
- [ ] **Paso 8: Captura** de `http://localhost:3000/` con `cdp.mjs` (390×844) para comprobar que la fuente y los tokens
  cargan (la página vieja se verá con la paleta nueva por los alias). Entregar informe.

### Tarea 3: Lógica pura y capa de datos

**Archivos:**
- Modificar: `src/lib/types.ts`, `src/lib/cart.ts`, `src/lib/tonos.ts` (quitar `textoSobre`), `src/lib/format.ts` (queda
  `pesos`, `fechaCorta`, `fechaHora`), `src/lib/carrito/reconciliar.ts`, `src/lib/data/busqueda.ts`,
  `src/lib/data/paginacion.ts` (si hace falta), `next.config.ts`, `vitest.config.mts`
- Crear: `src/lib/{compra,variantes,categorias,celular,ids,dispositivo,rutas,whatsapp,marca}.ts`,
  `src/lib/carrito/mensajes.ts`, `src/lib/supabase/publico.ts`, `src/lib/data/{etiquetas,catalogo,configuracion,bolsa,invalidar}.ts`,
  `src/app/api/catalogo/route.ts`, `src/app/api/buscar/route.ts`, `src/app/api/bolsa/route.ts`
- Borrar: `src/lib/data/catalog.ts` (sustituido por `catalogo.ts` + `configuracion.ts`)
- Pruebas: `src/lib/__tests__/{compra,variantes,categorias,celular,rutas,whatsapp,mensajes,configuracion,catalogo-mapeo,marca}.test.ts`,
  ampliar `busqueda`, `cart`, `reconciliar`; `src/app/api/__tests__/bolsa.test.ts`; añadir `// @vitest-environment jsdom`
  a las pruebas de componentes existentes.
- Además: actualizar mecánicamente los imports y nombres en el resto del código (`usarCarrito`→`useCarrito`,
  `Tono`→`Variante`, `tonos`→`variantes`, `numTonos`→`numVariantes`, `@/lib/data/catalog`→`@/lib/data/catalogo`,
  `enlaceWhatsApp`/`WHATSAPP_NEGOCIO` → `@/lib/whatsapp`) para que el proyecto compile al cerrar la oleada, salvo en
  `src/components/ui/*` (Tarea 2).

**Interfaces que produce:**
```ts
// types.ts — exactamente §7.1 del spec, más:
export type OrdenCatalogo = "destacados" | "precio-asc" | "precio-desc" | "nuevos";
export type PaginaProductos = { productos: Producto[]; total: number; pagina: number; porPagina: number };
export type SugerenciaProducto = { referencia: string; nombre: string; imagenPrincipal: string | null; precioBase: number | null; numVariantes: number; etiquetaVariante: EtiquetaVariante };
export type ProductoBolsa = { id: string; referencia: string; nombre: string; imagenPrincipal: string | null; stock: number; activo: boolean; escalones: Escalon[]; etiquetaVariante: EtiquetaVariante; variantes: Variante[] };
export type DatosBolsa = { productos: ProductoBolsa[]; reglas: ReglaDescuento[]; umbralPorMayor: number };
export type ConfiguracionPublica = { mensajeExito: string | null; umbralPorMayor: number; whatsappNegocio: string; envioInfo: string; pago: { metodo: string | null; numero: string | null; titular: string | null } };
// cart.ts
export const CLAVE_CARRITO = "anaya-carrito";
export const useCarrito; // estado { lineas, claveEnvio } + agregar(productoId, cantidad, tono?: { id: string; nombre: string } | null), establecer(productoId, tonoId, cantidad), quitar(productoId, tonoId), restaurar(linea: LineaCarrito, indice: number), vaciar(), prepararEnvio(): string
export function totalUnidades(e: { lineas: LineaCarrito[] }): number;
export function unidadesDeProducto(e: { lineas: LineaCarrito[] }, productoId: string): number;
export function useLineasDeProducto(productoId: string): LineaCarrito[];
export function useUnidadesDeProducto(productoId: string): number;
export function useTotalUnidades(): number;
export function escucharOtrasPestanas(): () => void; // listener 'storage' de CLAVE_CARRITO → useCarrito.persist.rehydrate()
// compra.ts — exactamente §7.3 del spec
// variantes.ts
export const ETIQUETAS_VARIANTE: readonly EtiquetaVariante[];
export function etiquetaPorDefecto(slugDepartamento: string | null): EtiquetaVariante;
export function resolverEtiqueta(o: { producto: EtiquetaVariante | null; categoria: EtiquetaVariante | null; departamento: EtiquetaVariante | null; slugDepartamento: string | null }): EtiquetaVariante;
export function pluralVariante(etiqueta: EtiquetaVariante, n: number): string;
export function verboElegir(etiqueta: EtiquetaVariante): string;    // "Elegir tono", "Elegir color", "Elegir diseño", "Elegir modelo", "Elegir aroma", "Elegir largo", "Elegir paleta"
export function tituloSelector(etiqueta: EtiquetaVariante): string; // "Elige el tono", …, "Elige la paleta"
export function muestrasConfiables(v: Pick<Variante, "colorHex">[]): boolean;
export function esNumeracionDeFoto(v: Pick<Variante, "nombre">[]): boolean;
// categorias.ts
export type Departamento = Categoria & { hijas: Categoria[] };
export function arbolDeCategorias(categorias: Categoria[]): Departamento[];
export function idsDeCategoria(slug: string, categorias: Categoria[]): string[] | null;
export function departamentoDe(categoriaId: string | null, categorias: Categoria[]): Categoria | null;
// celular.ts
export type DatosCliente = { nombre: string; whatsapp: string; ciudad: string };
export type PedidoGuardado = { id: string; numero: string; total: number; fecha: string };
export function leerDatosCliente(): DatosCliente | null;
export function guardarDatosCliente(d: DatosCliente): void;
export function olvidarDatosCliente(): void;
export function leerPedidosGuardados(): PedidoGuardado[];
export function guardarPedidoEnCelular(p: PedidoGuardado): void; // sin duplicar por id, más reciente primero, máx. 20
export function pedidoReciente(horas?: number, ahora?: number): PedidoGuardado | null; // por defecto 12 h
// ids.ts, dispositivo.ts, rutas.ts, whatsapp.ts, format.ts, marca.ts
export function esUuid(v: unknown): v is string;
export function vibrar(ms?: number): void; // 15 ms por defecto, silencioso si no existe
export function rutaProducto(referencia: string): string;
export function urlCatalogo(f: { categoria?: string | null; q?: string | null; orden?: OrdenCatalogo | null; pagina?: number | null }): string; // omite "destacados" y pagina 1
export function decodificarReferencia(param: string): string | null;
export const WHATSAPP_RESPALDO = "573228813646";
export function normalizarWhatsapp(v: string): string | null; // 10 dígitos que empiezan por 3 → "57"+; "57"+10 → igual; resto null
export function enlaceWhatsApp(mensaje: string, numero?: string | null): string; // https://wa.me/<numero o respaldo>?text=<encodeURIComponent>
export function pesos(valor: number): string;
export function fechaCorta(iso: string): string; // "10 nov" en America/Bogota
export function fechaHora(iso: string): string;  // "10 nov, 8:42 p. m." en America/Bogota
export const PALETA: { fondo: string; superficie: string; tinta: string; tintaSuave: string; linea: string; acento: string; acentoHondo: string; firma: string; ahorro: string; error: string };
// carrito/mensajes.ts
export function mensajeAmable(codigo: string, detalle?: string): { mensaje: string; campo?: "nombre" | "whatsapp" | "ciudad" | "bolsa" };
// carrito/reconciliar.ts — Disponibilidad incluye `variantes: Variante[]`; las líneas con tonoId desconocido se
// remapean por nombre (la línea resultante trae el id nuevo); nombre desconocido → "no-disponible"; variante agotada → "agotada".
// supabase/publico.ts (server-only)
export function clientePublico(): SupabaseClient;
// data/etiquetas.ts
export const ETIQUETA = { catalogo: "catalogo", precios: "precios", config: "config" } as const;
export const VERSION_DATOS = "v5";
// data/invalidar.ts (server-only) — revalidateTag(tag, { expire: 0 })
export function invalidarCatalogo(): void; export function invalidarPrecios(): void; export function invalidarConfig(): void;
// data/configuracion.ts (server-only)
export function mapearConfiguracion(filas: { clave: string; valor: string | null }[]): ConfiguracionPublica;
export function obtenerConfiguracionPublica(): Promise<ConfiguracionPublica>;
export function obtenerConfiguracionDePrecios(): Promise<{ reglas: ReglaDescuento[]; umbralPorMayor: number }>;
// data/catalogo.ts (server-only)
export const POR_PAGINA = 24;
export function mapearProducto(fila: FilaProducto, categorias: Categoria[]): Producto;
export function obtenerCategorias(): Promise<Categoria[]>;
export function obtenerProductos(o: { categoriaSlug?: string | null; busqueda?: string | null; orden?: OrdenCatalogo; pagina?: number; hastaPagina?: boolean }): Promise<PaginaProductos>; // hastaPagina: filas 0..pagina*24-1; pagina ≤ 10
export function obtenerDestacados(limite?: number): Promise<Producto[]>;
export function obtenerProductoPorReferencia(referencia: string): Promise<Producto | null>; // con variantes
export function obtenerRelacionados(p: Producto, limite?: number): Promise<Producto[]>;
export function obtenerSugerencias(q: string, limite?: number): Promise<{ total: number; productos: SugerenciaProducto[] }>;
// data/bolsa.ts (server-only, sin caché)
export function obtenerDatosBolsa(ids: string[]): Promise<DatosBolsa>;
// data/busqueda.ts
export function normalizarTexto(s: string): string;
export function gruposDeBusqueda(q: string): string[];
export function compactarReferencia(s: string): string;
```
Rutas GET: exactamente §8.3 del spec. `next.config.ts`: §10 del spec (conservar los redirects).

- [ ] **Paso 1: Escribir las pruebas que fallan** (valores exactos):
  - `compra.test.ts` con escalones `[{minCantidad:1,precioUnitario:8000},{minCantidad:3,precioUnitario:7500},{minCantidad:6,precioUnitario:6500}]`, stock 10:
    `resumenDeCompra({unidadesEnBolsa:1, unidadesNuevas:2})` → `unidadesTotales 3, precioUnitario 7500, subtotalNuevas 15000, escalonActivo.minCantidad 3, siguiente {faltan:3, precioUnitario:6500}, maxNuevas 9, bloqueo null`;
    `unidadesNuevas:0` → `bloqueo "sin-seleccion"`; stock 0 → `"agotado"`; escalones `[]` → `"sin-precio"`;
    `unidadesEnBolsa:8, unidadesNuevas:3` → `"supera-stock"` y `maxNuevas 2`.
  - `variantes.test.ts`: `pluralVariante("Tono",1)="1 tono"`, `("Tono",6)="6 tonos"`, `("Color",4)="4 colores"`,
    `("Diseño",3)="3 diseños"`, `("Paleta",2)="2 paletas"`; `etiquetaPorDefecto("labios")="Tono"`,
    `("bolsos-y-accesorios")="Color"`, `(null)="Tono"`; `resolverEtiqueta` respeta producto > categoría > departamento >
    defecto; `muestrasConfiables(["#FF0000","#00FF00"])=true`, con `"#e5308a"` → false, `["#FF0000","#FE0101"]` → false,
    `["rojo"]` → false, `[]` → false; `esNumeracionDeFoto(["Tono 1","Tono 2 modelo K"])=true`,
    `(["Rosado","Tono 1"])=false`; `verboElegir("Color")="Elegir color"`; `tituloSelector("Paleta")="Elige la paleta"`.
  - `categorias.test.ts`: con Labios (madre) + Lip gloss y Labial en barra (hijas) + Sombras (raíz plana):
    `arbolDeCategorias` devuelve 2 raíces ordenadas por `orden`; `idsDeCategoria("labios")` = [labios, gloss, barra];
    `idsDeCategoria("lip-gloss")` = [gloss]; desconocido → null; una hija cuyo padre no está en la lista sale como raíz;
    `departamentoDe(glossId)` = Labios.
  - `celular.test.ts` (jsdom): guardar/leer datos; pedidos sin duplicados y máx. 20; `pedidoReciente(12, ahora)` con uno
    de hace 11 h → ese pedido, de hace 13 h → null; si `localStorage.getItem` lanza, las lecturas devuelven null/[] sin
    lanzar.
  - `rutas.test.ts`: `rutaProducto("AC80/150") === "/producto/AC80%2F150"`;
    `urlCatalogo({categoria:"labios", orden:"destacados", pagina:1}) === "/?categoria=labios"`;
    `urlCatalogo({q:"usk 621", pagina:3}) === "/?q=usk+621&pagina=3"`; `urlCatalogo({}) === "/"`;
    `decodificarReferencia("100%") === null`; `decodificarReferencia("AC80%2F150") === "AC80/150"`.
  - `whatsapp.test.ts`: `normalizarWhatsapp("300 123 4567") === "573001234567"`,
    `("+57 300-123-4567") === "573001234567"`, `("12345") === null`;
    `enlaceWhatsApp("Hola mundo","573001234567") === "https://wa.me/573001234567?text=Hola%20mundo"`; con `null` usa
    `WHATSAPP_RESPALDO`.
  - `mensajes.test.ts`: `mensajeAmable("SIN_STOCK","Labial X")` menciona «Labial X» y `campo:"bolsa"`;
    `DEMASIADOS_PEDIDOS`, `TONO_NO_DISPONIBLE`, `PEDIDO_MUY_GRANDE` tienen texto propio; código desconocido → mensaje
    genérico sin `campo`.
  - `busqueda.test.ts` (ampliar): `gruposDeBusqueda("Pestañas") = ["pestana"]`,
    `("labiales rojos") = ["labial","rojo"]`, `("brocha para polvo") = ["brocha","polvo"]`,
    `("rimel") = ["rimel|mascara|pestanina"]`, `("usk621") = ["usk621"]`, `("GLS-735") = ["gls","735"]`, `("a") = []`,
    nunca más de 5 grupos; `compactarReferencia("USK-621") === "usk621"`.
  - `cart.test.ts` (ampliar): los hooks renombrados; `restaurar(linea, 0)` la devuelve a su posición;
    `escucharOtrasPestanas()` + `window.dispatchEvent(new StorageEvent("storage",{key:"anaya-carrito"}))` llama a
    `persist.rehydrate` (espía); la limpieza quita el listener.
  - `reconciliar.test.ts` (ampliar): línea con `tonoId` desconocido y `tonoNombre` que existe → estado "ok" con el id
    nuevo; nombre inexistente → "no-disponible"; variante con `agotado:true` → "agotada".
  - `configuracion.test.ts`: `mapearConfiguracion([])` → `umbralPorMayor 200000`, `whatsappNegocio "573228813646"`,
    `envioInfo` = texto por defecto del spec, `pago` con nulls, `mensajeExito null`; un `umbral_por_mayor` no numérico
    cae al defecto; `whatsapp_negocio` inválido cae al respaldo.
  - `catalogo-mapeo.test.ts`: `mapearProducto` resuelve la etiqueta (producto null + categoría «Paleta» → «Paleta»; sin
    nada y departamento `bolsos-y-accesorios` → «Color»), `numVariantes` desde `num_tonos`, `variantes` null si no vienen
    embebidas, `destacado`, `categoriaSlug`.
  - `marca.test.ts`: cada color de `PALETA` es igual al token homónimo de `globals.css`.
  - `api/__tests__/bolsa.test.ts`: con `obtenerDatosBolsa` simulado, `GET /api/bolsa?ids=abc,<uuid>` lo llama solo con
    `[<uuid>]`, responde `Cache-Control: no-store`; más de 60 ids se recortan a 60.
- [ ] **Paso 2: Correr** `npx vitest run src/lib src/app/api` → las nuevas FALLAN.
- [ ] **Paso 3: Implementar** los módulos con las firmas de arriba. Detalles que no deciden las pruebas:
  - `catalogo.ts` usa `clientePublico()` y `unstable_cache` (revalidate 300, keyParts con `VERSION_DATOS`, tags de
    `ETIQUETA`); la ficha además en React `cache()`. Búsqueda: `rpc("buscar_productos", { p_grupos, p_categorias },
    { count: "exact" }).select(CAMPOS_GRILLA)`; sin caché. Orden por precio con `precio_base`, desempate `id`. Filtro de
    categoría con `.in("category_id", ids)`. `obtenerSugerencias` ordena primero la referencia compacta exacta.
  - `obtenerDatosBolsa` usa `productos_del_carrito` + `product_shades` (id, nombre, color_hex, orden, agotado) +
    categorías para la etiqueta.
  - Ninguna consulta devuelve vacío ante un error: lanza con `console.error`.
  - `vitest.config.mts`: `environment: "node"`.
- [ ] **Paso 4: Actualizar consumidores** mecánicamente (ver «Además»).
- [ ] **Paso 5: Correr** `npx vitest run` (todo) → PASAN; `npx tsc --noEmit` → 0 errores fuera de `src/components/ui`.
- [ ] **Paso 6: Probar las rutas** contra el servidor de desarrollo: `curl "http://localhost:3000/api/buscar?q=usk621"`
  devuelve USK-621 primero; `/api/catalogo?categoria=lip-gloss` devuelve 24 o menos y `total` 27;
  `/api/bolsa?ids=<id real>` devuelve variantes con `agotado`. (Requiere la Tarea 1 aplicada; si aún no, espera y
  reintenta.) Entregar informe.

---

## Oleada 2 (en paralelo): Tareas 4 a 10

Todas consumen las interfaces de las Tareas 2 y 3. Ninguna modifica `src/components/ui/*`, `src/lib/*` de la Tarea 3,
`globals.css` ni `layout.tsx`.

### Tarea 4: Marco de la tienda, búsqueda rápida y páginas fijas

**Archivos:**
- Crear: `src/app/(tienda)/layout.tsx`; `src/components/tienda/{Encabezado,Pie,BarraBeneficios,BotonBolsa,SincronizarBolsa,MisPedidos}.tsx`;
  `src/components/catalogo/{BusquedaRapida,CampoBusqueda}.tsx`; `src/lib/busqueda-rapida.ts`; `src/lib/legal.ts`;
  `src/app/(tienda)/privacidad/page.tsx`; `src/app/(tienda)/mis-pedidos/page.tsx`
- Reescribir: `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`
- Borrar: `src/components/carrito/BotonFlotante.tsx`, `public/banner.png`, `public/banner.jpg`
- Pruebas: `src/components/tienda/__tests__/{BotonBolsa,MisPedidos,BarraBeneficios}.test.tsx`,
  `src/components/catalogo/__tests__/BusquedaRapida.test.tsx`

**Interfaces que produce:**
```ts
// src/lib/busqueda-rapida.ts
export function abrirBusqueda(textoInicial?: string): void;
export function cerrarBusqueda(): void;
export function useBusquedaAbierta(): { abierta: boolean; textoInicial: string };
// src/components/catalogo/CampoBusqueda.tsx — botón con aspecto de campo «Busca por nombre o referencia» que llama abrirBusqueda()
export function CampoBusqueda(): JSX.Element;
// src/components/tienda/BarraBeneficios.tsx — null si no hay reglas ni umbral
export function BarraBeneficios(p: { reglas: ReglaDescuento[]; umbralPorMayor: number }): JSX.Element | null;
// src/lib/legal.ts
export const VERSION_POLITICA = "2026-11-10";
```
- [ ] **Paso 1: Pruebas que fallan**
  - `BotonBolsa.test.tsx`: con 3 unidades en el store, el enlace a `/carrito` tiene `aria-label "Bolsa, 3 unidades"` y
    muestra «3»; con 0 no muestra contador.
  - `BusquedaRapida.test.tsx` (fetch simulado con `{ total: 2, productos:[USK-621, USK-208] }`): escribir «usk» muestra
    2 sugerencias tras el debounce (timers falsos 200 ms) con enlaces a `rutaProducto(ref)`; «Ver los 2 resultados» →
    `href="/?q=usk"`; Enter con «usk621» (coincide la referencia compacta) navega a `/producto/USK-621` (router
    simulado); Escape llama `cerrarBusqueda`; sin resultados muestra un enlace de WhatsApp.
  - `MisPedidos.test.tsx`: lista número, fecha y total de los guardados; vacío → «Aquí aparecen los pedidos que confirmes
    desde este celular.»
  - `BarraBeneficios.test.tsx`: con regla 50000→5 % y umbral 200000 el texto contiene «5 % menos desde $50.000» y «Por
    mayor desde $200.000»; sin reglas y umbral 0 → no pinta nada.
- [ ] **Paso 2: Correr** `npx vitest run src/components/tienda src/components/catalogo/__tests__/BusquedaRapida.test.tsx` → FALLAN.
- [ ] **Paso 3: Implementar** según §6.1, §6.4, §6.10 del spec. `(tienda)/layout.tsx` (servidor) lee
  `obtenerConfiguracionPublica()` y pasa el WhatsApp a `Encabezado` y `Pie`; monta `Avisos`, `SincronizarBolsa`
  (`useEffect(() => escucharOtrasPestanas(), [])`) y `BusquedaRapida`. `BusquedaRapida` usa `Hoja`
  (`pantallaCompleta` en celular) + `useHistorialHoja`, `<form role="search">`, `GET /api/buscar`. `error.tsx` usa
  `retry()` (lee `03-file-conventions/error.md`). Colores de `global-error` desde `PALETA`.
- [ ] **Paso 4: Correr** las pruebas → PASAN; `npx tsc --noEmit` limpio en tus archivos.
- [ ] **Paso 5: Capturas** (390×844 y 1366×900) de la cabecera, la búsqueda abierta con «usk», `/privacidad` y
  `/mis-pedidos`. Entregar informe.

### Tarea 5: Catálogo

**Archivos:**
- Crear: `src/app/(tienda)/page.tsx`, `src/app/(tienda)/loading.tsx`;
  `src/components/catalogo/{PestanasDepartamentos,ChipsSubcategorias,BarraResultados,ListaProductos,TarjetaProducto,AgregarRapido,RielDestacados,EstadoVacio}.tsx`
  (`ListaProductos` y `TarjetaProducto` reescritos)
- Borrar: `src/app/page.tsx`, `src/app/loading.tsx`,
  `src/components/catalogo/{Encabezado,CintaBeneficios,Buscador,ChipsCategorias,OrdenProductos}.tsx`,
  `src/components/catalogo/__tests__/TarjetaProducto.test.tsx` (se reemplaza)
- Pruebas: `src/components/catalogo/__tests__/{TarjetaProducto,AgregarRapido,ListaProductos,PestanasDepartamentos}.test.tsx`

**Interfaces que consume:** Tarea 2 (Boton/BotonEnlace, Stepper, Iconos, Esqueleto, mostrarAviso), Tarea 3
(`obtenerProductos({hastaPagina:true})`, `obtenerCategorias`, `arbolDeCategorias`, `obtenerDestacados`,
`obtenerConfiguracionDePrecios`, `pluralVariante`, `verboElegir`, `resumenDeCompra`, `useCarrito`,
`useUnidadesDeProducto`, `rutaProducto`, `urlCatalogo`, `vibrar`, `pesos`, `GET /api/catalogo`), Tarea 4
(`BarraBeneficios`, `CampoBusqueda`).

- [ ] **Paso 1: Pruebas que fallan**
  - `TarjetaProducto.test.tsx`: foto y nombre están dentro de un mismo enlace a `/producto/AC80%2F150`; muestra
    «Ref. AC80/150», «$8.000» y «c/u», «3 o más: $7.500 c/u»; con un solo escalón no aparece «o más»; con 6 variantes y
    etiqueta Tono el botón dice «Elegir tono · 6» y es un enlace a la ficha; stock 0 → «Agotado» y ningún botón de
    agregar; sin escalones → «Precio por confirmar»; stock 3 → «Quedan 3»; no aparece el texto «Combo».
  - `AgregarRapido.test.tsx`: producto sin variantes, «Agregar» agrega 1 al store y llama `mostrarAviso` con título
    «Agregado a tu bolsa» y acción «Ver bolsa»; después muestra un stepper con 1; bajar a 0 quita la línea y el aviso
    ofrece «Deshacer» que la restaura; el máximo respeta el stock.
  - `ListaProductos.test.tsx`: con 24 de 30, «Ver más productos» pide `/api/catalogo?…&pagina=2`, agrega los 6, muestra
    «Viendo 30 de 30», oculta el botón y llama `history.replaceState` con `pagina=2`; un fallo de red muestra
    «No se pudo cargar. Volver a intentar».
  - `PestanasDepartamentos.test.tsx`: «Todo» + departamentos con `href` de `urlCatalogo`; la activa tiene
    `aria-current="page"`.
- [ ] **Paso 2: Correr** `npx vitest run src/components/catalogo` → FALLAN.
- [ ] **Paso 3: Implementar** §6.2 y §6.3 del spec. `page.tsx` lee `searchParams` (`q`, `categoria`, `orden`, `pagina`),
  pide en paralelo productos (`hastaPagina: true`), categorías, precios y destacados; `ListaProductos` va con
  `key={q|categoria|orden}`. `TarjetaProducto` presentacional con `memo`; `AgregarRapido` es el único cliente con
  suscripción al store por producto. Navegación entre departamentos con `<Link scroll={false}>`.
- [ ] **Paso 4: Correr** las pruebas → PASAN; tsc limpio en tus archivos.
- [ ] **Paso 5: Capturas** 390×844 y 1366×900: inicio (el primer producto debe verse en la primera pantalla del
  celular), «Labios», «Ver más», tarjeta tras «Agregar». Entregar informe.

### Tarea 6: Ficha de producto y vista rápida

**Archivos:**
- Crear: `src/app/@modal/(.)producto/[referencia]/{page,loading}.tsx`;
  `src/app/(tienda)/producto/[referencia]/{page,loading,not-found}.tsx`;
  `src/components/producto/{FichaProducto,ModalProducto,PanelCompra,SelectorVariantes,PreciosPorCantidad,FotoProducto,RielRelacionados,ProductoNoDisponible}.tsx`
  (`PanelCompra` y `FotoProducto` reescritos); `src/hooks/useCompraProducto.ts`
- Borrar: `src/app/producto/` (todo), `src/components/producto/{HojaCompra,SelectorTonos,TablaEscalones,SelectorCantidad}.tsx`,
  `src/components/producto/__tests__/{PanelCompra,SelectorTonos}.test.tsx` (se reemplazan), `src/app/acciones-catalogo.ts`
- Pruebas: `src/hooks/__tests__/useCompraProducto.test.tsx`,
  `src/components/producto/__tests__/{SelectorVariantes,PanelCompra,PreciosPorCantidad,ModalProducto}.test.tsx`

**Interfaces que produce:**
```ts
export function useCompraProducto(producto: Producto): {
  seleccion: Record<string, number>; // clave = id de variante, o "unica" si el producto no tiene variantes
  cambiar: (clave: string, cantidad: number) => void;
  resumen: ResumenCompra;
  agregar: () => boolean; // agrega por variante, vibra, muestra el aviso, limpia; false si hay bloqueo
};
```
- [ ] **Paso 1: Pruebas que fallan**
  - `useCompraProducto.test.tsx`: producto con 3 variantes y 1 unidad ya en la bolsa; `cambiar(A,1)` y `cambiar(B,1)` →
    `resumen.unidadesTotales 3`, `precioUnitario 7500`; `agregar()` deja 2 líneas nuevas en el store, llama
    `mostrarAviso` con detalle «2 × {nombre}» y limpia la selección; con selección vacía devuelve false.
  - `SelectorVariantes.test.tsx`: las filas salen en el orden de `orden` (nunca agrupadas: no aparecen títulos de
    familia como «Rojos»); variante agotada muestra «Agotado» y no tiene stepper; con 13 variantes aparece
    «Buscar entre 13 tonos» y filtrar «4» conserva el orden; con muestras no confiables no hay círculos
    (`queryAllByTestId("muestra")` vacío); con nombres «Tono N» aparece «La numeración corresponde a la foto»; el título
    es `tituloSelector(etiqueta)`.
  - `PanelCompra.test.tsx`: sin selección el botón dice «Elige un tono» y al tocarlo muestra «Elige al menos un tono»;
    con 2 unidades del tono A el botón dice «Agregar 2 · $16.000»; producto sin variantes empieza en 1 y dice
    «Agregar 1 · $8.000»; con 2+ variantes aparece «Puedes mezclar tonos: cuentan juntos para el precio.»
  - `PreciosPorCantidad.test.tsx`: tres filas «1 u», «3+», «6+» con sus precios; con 4 unidades totales la fila «3+»
    tiene `aria-current="true"`.
  - `ModalProducto.test.tsx`: con `usePathname` = `/producto/X`, tocar Cerrar dos veces seguidas llama `router.back` una
    sola vez; con `usePathname` = `/carrito` no pinta nada.
- [ ] **Paso 2: Correr** `npx vitest run src/hooks src/components/producto` → FALLAN.
- [ ] **Paso 3: Implementar** §4 (cierre y guard), §6.5, §6.6 y §6.7 del spec. Lee en la doc de Next:
  `intercepting-routes.md`, `parallel-routes.md`, `default.md`, `incremental-static-regeneration.md`,
  `generate-static-params.md`, `use-link-status.md`. Ficha y modal: `export const revalidate = 300` y
  `generateStaticParams() { return [] }`; la referencia se decodifica con `decodificarReferencia` (malformada →
  `notFound()` en la página, `ProductoNoDisponible` en el modal). En el modal, al agregar: aviso + `router.back()`.
  `FotoProducto` con `object-contain`, a todo el ancho, abre `VisorImagen`. Compartir con `navigator.share` o copiar.
- [ ] **Paso 4: Verificar la interceptación:** desde `/` tocar una tarjeta abre el modal sin desmontar la lista (el
  contador «Viendo N» y el scroll siguen al cerrar); cargar `/producto/<ref>` directo muestra la página completa;
  `/no-existe`, `/producto/100%25` y `/producto/%E0%A4%A` responden 404, nunca 500 (`curl -s -o /dev/null -w "%{http_code}"`).
  Si la interceptación no alcanza `(tienda)/producto`,
  anótalo en el informe (la integración moverá el slot a `(tienda)/@modal`).
- [ ] **Paso 5: Correr** las pruebas → PASAN; tsc limpio en tus archivos.
- [ ] **Paso 6: Capturas** 390×844 y 1366×900: modal de un producto con 6 tonos (antes y después de elegir 2), uno con
  36 tonos (PCL-885), uno sin variantes, la página directa y el aviso tras agregar. Entregar informe.

### Tarea 7: Bolsa, confirmación y pedido

**Archivos:**
- Crear: `src/app/(tienda)/carrito/{page,loading,actions}.tsx|ts`;
  `src/components/bolsa/{VistaBolsa,GrupoProducto,LineaVariante,AvisoCambios,ProgresoBeneficio,ResumenBolsa,FormularioDatos,BarraConfirmar,PantallaConfirmando,BolsaVacia,PedidosRecientes}.tsx`;
  `src/hooks/{useBolsa,useConfirmarPedido}.ts`; `src/app/(tienda)/pedido/[id]/{page,loading}.tsx`;
  `src/components/pedido/{TarjetaPago,PasosPedido,ResumenPedido,CopiarDato,GuardarPedido}.tsx`;
  `src/lib/data/pedido-publico.ts`
- Modificar: `src/lib/email/order-template.ts`, `src/lib/email/send-order.ts` (colores de `PALETA`, sin emoji)
- Borrar: `src/app/carrito/` y `src/app/pedido/` (versiones viejas)
- Pruebas: `src/app/(tienda)/carrito/__tests__/actions.test.ts`,
  `src/hooks/__tests__/useBolsa.test.tsx`, `src/components/bolsa/__tests__/{VistaBolsa,FormularioDatos}.test.tsx`,
  `src/components/pedido/__tests__/TarjetaPago.test.tsx`; ajustar `order-template.test.ts`

**Interfaces que produce:**
```ts
// (tienda)/carrito/actions.ts
export type ResultadoConfirmacion =
  | { ok: true; id: string; numero: string; total: number }
  | { ok: false; mensaje: string; campo?: "nombre" | "whatsapp" | "ciudad" | "bolsa"; codigo?: string };
export async function confirmarPedido(previo: ResultadoConfirmacion | null, datos: FormData): Promise<ResultadoConfirmacion>;
// FormData: nombre, whatsapp, ciudad, notas, items (JSON de itemsParaPedido), clave, adicional (opcional, AB-\d{4,})
// hooks
export function useBolsa(): { estado: "hidratando" | "cargando" | "listo" | "error"; datos: DatosBolsa | null; reconciliado: CarritoReconciliado | null; totales: Totales | null; reintentar: () => void };
export function useConfirmarPedido(): { resultado: ResultadoConfirmacion | null; enviando: boolean; accion: (fd: FormData) => void };
// data/pedido-publico.ts (server-only)
export function obtenerPedidoPublico(id: string): Promise<Pedido | null>; // sin datos de administración
```
- [ ] **Paso 1: Pruebas que fallan**
  - `actions.test.ts` (Supabase, `after` y `revalidateTag` simulados): nombre de 81 caracteres → `campo:"nombre"`;
    WhatsApp «123» → `campo:"whatsapp"`; 41 líneas → mensaje de pedido grande; una línea de 51 unidades → igual; variante
    agotada o inexistente → `codigo:"TONO_NO_DISPONIBLE", campo:"bolsa"`; caso válido llama `rpc("crear_pedido")` con
    `p_notas` que empieza por «[Adicional a AB-0098] » cuando llega `adicional`, luego actualiza `politica_version` con
    `VERSION_POLITICA`, llama `revalidateTag("catalogo","max")` y deja el correo dentro de `after`; error
    `DEMASIADOS_PEDIDOS` → mensaje de `mensajeAmable`.
  - `useBolsa.test.tsx`: no pide nada mientras el store no se hidrató; con ids pide `/api/bolsa?ids=…` una vez; tras un
    error, `reintentar()` hace una nueva petición.
  - `VistaBolsa.test.tsx`: quitar una variante muestra un aviso con «Deshacer» que la restaura; con campos vacíos la barra
    dice «Completar mis datos» y al tocarla enfoca «Nombre»; con datos completos dice «Confirmar pedido · $X»; muestra
    «Total productos» y la línea de envío con `envioInfo`; con un pedido reciente en el celular muestra el aviso de
    adicional con su número.
  - `FormularioDatos.test.tsx`: con datos guardados los rellena; con «Recordar» desmarcado no guarda; marcado guarda al
    confirmar.
  - `TarjetaPago.test.tsx`: el enlace «Ya pagué: enviar comprobante» abre `wa.me/<whatsappNegocio>` con un texto que
    contiene el número de pedido, el total con `pesos()` y la URL del pedido; sin datos de pago muestra «Te enviamos los
    datos de pago por WhatsApp».
  - `order-template.test.ts`: sin «Código usado», sin emoji.
- [ ] **Paso 2: Correr** `npx vitest run src/app src/hooks src/components/bolsa src/components/pedido src/lib/__tests__/order-template.test.ts` → FALLAN.
- [ ] **Paso 3: Implementar** §6.8, §6.9 y §9.3 del spec. `after` desde `next/server` (lee `04-functions/after.md`).
  `VistaBolsa` solo orquesta (~150 líneas). `useConfirmarPedido` envuelve `useActionState`: pone `clave`
  (`prepararEnvio()`), y si sale bien guarda los datos si se pidió, vacía la bolsa y navega a `/pedido/{id}` dentro del
  propio manejador, sin efectos de orquestación. `GuardarPedido` llama `guardarPedidoEnCelular` al montar.
  Los textos «Comprobante» solo para el soporte de pago.
- [ ] **Paso 4: Correr** las pruebas → PASAN; tsc limpio en tus archivos.
- [ ] **Paso 5: Capturas** 390×844 y 1366×900 de la bolsa con 2 productos (uno con 2 tonos), formulario a medias y el
  pedido de prueba `AB-0009` (su id por SELECT). NO pulses «Confirmar pedido». Entregar informe.

### Tarea 8: Panel — pedidos, navegación y seguridad

**Archivos:**
- Modificar: `src/proxy.ts`, `src/app/admin/(panel)/{layout,page,TablaPedidos,acciones-pedidos}.tsx|ts`,
  `src/app/admin/login/*`, `src/app/admin/(panel)/recibos/{page,ConstructorRecibo}.tsx` (solo: restos del código, aceptar
  `?pedido=id`, colores AA, sin emoji), `src/lib/data/orders.ts`, `src/lib/pdf/recibo.ts` (colores de `PALETA`), y el
  archivo donde vive hoy `exigirSesion` (queda como envoltorio de `exigirAdmin` hasta la integración)
- Crear: `src/app/admin/(panel)/{loading,error}.tsx`, `src/app/admin/(panel)/NavegacionPanel.tsx`,
  `src/lib/admin/sesion.ts`, `src/lib/admin/pedidos.ts`
- Pruebas: `src/lib/__tests__/admin-pedidos.test.ts`, `src/lib/__tests__/admin-sesion.test.ts`

**Interfaces que produce:**
```ts
// src/lib/admin/sesion.ts (server-only)
export const exigirAdmin: () => Promise<{ userId: string }>; // React cache(); sin sesión o sin es_admin → redirect("/admin/login")
// src/lib/admin/pedidos.ts (puro)
export function siguientePaso(estado: EstadoPedido): { estado: EstadoPedido; etiqueta: string } | null;
export function mensajeCobro(p: Pedido, pago: ConfiguracionPublica["pago"]): string;
export function mensajeEnvio(p: Pedido): string;
export function inicioDelDiaBogota(ahora: Date): Date;
export function kpisDelDia(pedidos: Pick<Pedido, "creadoEn" | "total" | "estado">[], ahora: Date): { pedidos: number; vendido: number; porCobrar: number };
```
- [ ] **Paso 1: Pruebas que fallan**: `siguientePaso("nuevo") = {estado:"pagado", etiqueta:"Confirmar pago"}`,
  `("pagado") = {estado:"enviado", etiqueta:"Marcar enviado"}`, `("enviado")` y `("cancelado")` = null;
  `mensajeCobro` contiene número de pedido, total con `pesos()`, método, número y titular; `mensajeEnvio` contiene el
  número; `inicioDelDiaBogota(new Date("2026-11-11T03:30:00Z"))` = `2026-11-10T05:00:00.000Z`; `kpisDelDia` excluye
  cancelados de lo vendido y cuenta solo los del día de Bogotá; `exigirAdmin` con usuario y `es_admin` false redirige
  (Supabase simulado).
- [ ] **Paso 2: Correr** `npx vitest run src/lib/__tests__/admin-*.test.ts` → FALLAN.
- [ ] **Paso 3: Implementar** §10 (proxy) y §11.1–§11.2, §11.9–§11.10 del spec: barra inferior de 4 destinos en celular
  y lateral en escritorio, Realtime con estado de la suscripción e indicador «En vivo / Reconectando», `router.refresh()`
  en `visibilitychange` y al reconectar, pedido nuevo resaltado, contador en `document.title`; tarjeta con el siguiente
  paso, «Cancelar» con confirmación, WhatsApp de cobro/envío, «Recibo»; estados por `rpc("cambiar_estado_pedido")` con
  la service role tras `exigirAdmin`; invalidar con `invalidarCatalogo()` cuando cambia el stock; quitar el join a
  `access_codes` y `codigoUsado`; fechas con `fechaHora`. Tokens nuevos (sin alias) en todos tus archivos.
- [ ] **Paso 4: Correr** las pruebas → PASAN; tsc limpio en tus archivos. Entregar informe (no hay sesión de panel para
  capturas; verifica con pruebas y lectura).

### Tarea 9: Panel — productos, categorías, ajustes, importación y QR

**Archivos:**
- Modificar: `src/app/admin/(panel)/productos/**` (page, [id]/page, FormularioProducto partido en
  `CampoImagen.tsx`, `EditorEscalones.tsx`, `EditorVariantes.tsx`; actions, BotonEliminarProducto, importar/*),
  `src/app/admin/(panel)/categorias/page.tsx` (+ `EditorCategorias.tsx`, `actions.ts`),
  `src/app/admin/(panel)/configuracion/*`, `src/app/admin/(panel)/descuentos/page.tsx`, `src/app/admin/(panel)/qr/*`,
  `src/lib/data/admin-catalog.ts`, `src/lib/csv.ts`, `src/lib/imagen.ts`, `src/lib/storage.ts`
- Crear: `src/lib/admin/variantes.ts`, `src/lib/admin/importacion.ts`, `src/lib/admin/ajustes.ts`,
  `src/lib/admin/filtros.ts`, `src/lib/imagen-navegador.ts`
- Pruebas: `src/lib/__tests__/admin-{variantes,importacion,ajustes,filtros}.test.ts`, ampliar `csv.test.ts`

**Interfaces que produce:**
```ts
// src/lib/admin/variantes.ts
export type VarianteEditable = { id: string | null; nombre: string; colorHex: string; agotado: boolean };
export function diffVariantes(actuales: Variante[], nuevas: VarianteEditable[]): { insertar: Omit<Variante, "id">[]; actualizar: Variante[]; borrar: string[] }; // orden = posición en `nuevas`
// src/lib/admin/importacion.ts
export function planImportacion(filas: FilaCsv[], existentes: Map<string, Producto>): { nuevos: FilaCsv[]; cambios: { referencia: string; campos: Record<string, unknown> }[]; sinCambios: number; avisos: string[] };
// src/lib/admin/ajustes.ts
export const CLAVES_AJUSTES: readonly ["mensaje_exito","umbral_por_mayor","pago_metodo","pago_numero","pago_titular","whatsapp_negocio","envio_info"];
export function validarAjuste(clave: string, valor: string): { ok: true; valor: string } | { ok: false; error: string };
// src/lib/admin/filtros.ts
export type FiltroProductos = "todos" | "activos" | "ocultos" | "agotados" | "sin-foto" | "destacados";
export function filtrarProductosAdmin(productos: Producto[], filtro: FiltroProductos, categoriaId?: string | null): Producto[];
// src/lib/imagen-navegador.ts
export function comprimirImagen(archivo: File, ladoMaximo?: number, calidad?: number): Promise<Blob>; // 1600 px, 0.85, JPEG
```
- [ ] **Paso 1: Pruebas que fallan**: `diffVariantes` (una existente renombrada → `actualizar` con el mismo id; una
  quitada → `borrar`; una nueva sin id → `insertar` con `orden` según posición; reordenar cambia `orden` sin borrar);
  `planImportacion` (una fila con `stock` vacío para una referencia existente no incluye `stock` en `campos`; nunca
  incluye `activo` para existentes; una referencia nueva va a `nuevos`; precios iguales → `sinCambios`);
  `validarAjuste("whatsapp_negocio","300 123 4567") = {ok:true, valor:"573001234567"}`, `("whatsapp_negocio","12")` →
  error, clave desconocida → error, `("umbral_por_mayor","-5")` → error; `filtrarProductosAdmin` por cada filtro y por
  categoría.
- [ ] **Paso 2: Correr** `npx vitest run src/lib/__tests__/admin-*.test.ts src/lib/__tests__/csv.test.ts` → FALLAN.
- [ ] **Paso 3: Implementar** §11.3–§11.8 y §11.10–§11.11 del spec: filtros y acciones de fila (Ocultar/Mostrar,
  Destacar), guardar conservando `?q=` y con aviso; formulario con etiqueta de variante («Según la categoría» = null),
  destacado, editor de variantes con «Agotado», subir/bajar y guardado por id con `diffVariantes`; validar todo antes de
  escribir; foto comprimida en el navegador antes de enviarla, error real, borrar la anterior del bucket; editor de
  categorías (nombre sin cambiar el slug, madre solo entre raíces, orden, etiqueta, activo, número de productos);
  ajustes con `CLAVES_AJUSTES` + `validarAjuste` y el campo «Información de envío», sin «Horas que dura un código»;
  importador con `planImportacion` y resumen previo; QR con módulos `PALETA.tinta` y URL con `?o=qr`. Todas las acciones
  llaman `exigirAdmin()` primero y `invalidarCatalogo/Precios/Config()` después de escribir. Enlaces a la tienda con
  `<a target="_blank">`. Tokens nuevos (sin alias) en tus archivos.
- [ ] **Paso 4: Correr** las pruebas → PASAN; tsc limpio en tus archivos. Entregar informe.

### Tarea 10: Operación y scripts

**Archivos:**
- Modificar: `src/app/api/diagnostico/route.ts`, `scripts/cargar-catalogo-engol.mjs`, `scripts/crear-admin.mjs`,
  `scripts/verificar-migracion.mjs`, `SETUP.md`
- Crear: `src/lib/clave-segura.ts`
- Pruebas: `src/lib/__tests__/clave-segura.test.ts`, `src/app/api/__tests__/diagnostico.test.ts`

**Interfaces que produce:** `export function clavesIguales(a: string | null, b: string | null): boolean` (timingSafeEqual,
false con longitudes distintas o nulos).

- [ ] **Paso 1: Pruebas que fallan**: `clavesIguales("abc","abc")=true`, `("abc","abd")=false`, `("abc","abcd")=false`,
  `(null,"x")=false`; la ruta sin clave o con clave errada responde 404; con clave correcta y sin `?correo=1` no llama a
  Resend (simulado); con `?correo=1` sí.
- [ ] **Paso 2: Correr** → FALLAN.
- [ ] **Paso 3: Implementar** §10 del spec. `crear-admin.mjs` además inserta el usuario en `administradores`.
  `verificar-migracion.mjs` comprueba v5 (funciones, columnas, `orders` en la publicación) y avisa si
  `/auth/v1/settings` devuelve `disable_signup:false`. SETUP.md: marcador `<tu-clave-de-diagnóstico>` en vez de la clave,
  aviso de rotarla, y la nota de que el importador solo agrega referencias nuevas. No ejecutes los scripts.
- [ ] **Paso 4: Correr** → PASAN. Entregar informe.

---

## Oleada 3: integración, revisión y despliegue (orquestador)

### Tarea 11: Integración
- [ ] Commit por tarea de las oleadas 1 y 2 (mensajes en español, con el pie de coautoría).
- [ ] Aplicar los «Necesito en X» de los informes; si la interceptación lo exige, mover `@modal` a `(tienda)/@modal`.
- [ ] Borrar los alias de tokens y los exports viejos de `src/components/ui/*` cuando ya nadie los use
  (`grep -rn "rosa-nube\|fucsia-texto\|lila-suave\|shadow-petalo\|font-display\|exigirSesion" src` vacío).
- [ ] `npx tsc --noEmit` → 0; `npx vitest run` → todo verde; `npm run build` → OK y la tabla de rutas muestra `/producto/[referencia]` e `(.)producto` como ISR.

### Tarea 12: Revisión
- [ ] Revisión adversaria por dimensiones (cumplimiento del spec, errores de lógica y estados límite, seguridad,
  accesibilidad, coherencia visual con §5 y textos con las reglas globales), cada hallazgo verificado antes de corregir.
- [ ] Recorrido con `cdp.mjs` en 390×844 y 1366×900 (sobre `next start` del build) con las capturas del §13 del spec y
  revisión de cada una contra las antimetas del §2.
- [ ] Corregir y repetir hasta que la revisión no encuentre nada nuevo de severidad media o mayor.

### Tarea 13: Documentación y despliegue
- [ ] Actualizar `Funcionalidades.md`, `README.md` y la sección «Decisiones del rediseño» del estudio.
- [ ] Push de `rediseno-catalogo` → revisar la vista previa de Vercel; merge a `master` y push → producción.
- [ ] Aplicar `migracion-v5-departamentos.sql`; verificar producción (inicio, departamentos, búsqueda, modal, bolsa).
- [ ] Informe final con el respaldo, cómo revertir y las tareas de la dueña (§15 del spec).
