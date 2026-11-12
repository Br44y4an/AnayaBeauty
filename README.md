# Anaya Beauty — Catálogo digital

Catálogo de maquillaje para vender en transmisiones en vivo de TikTok. Las
clientas entran por un QR o un enlace de WhatsApp, arman su pedido con precios
que bajan según la cantidad y **lo confirman en el momento**, sin códigos ni
esperas. El cobro se coordina después por WhatsApp y se verifica a mano. Cada
pedido llega al panel en vivo y por correo.

Producción: https://anaya-beauty-tau.vercel.app

**Versión actual: v5** (rediseño de la tienda y del panel). Qué hace cada pieza:
[Funcionalidades.md](Funcionalidades.md). Puesta en marcha: [SETUP.md](SETUP.md).
Diseño y decisiones: [docs/superpowers/specs/](docs/superpowers/specs/) y el
[estudio](docs/estudio/2026-11-10-estudio-completo.md).

## Stack

Next.js 16 · TypeScript · React 19 · Tailwind 4 · Supabase (Postgres, Auth,
Storage, Realtime) · Resend · Zustand · jsPDF · Vitest. Todo en capa gratuita.

## Arranque local

```bash
npm install
cp .env.example .env.local     # y completa los valores
npm run dev
```

Next 16 cambió varias convenciones (por ejemplo `proxy.ts` en vez de
`middleware.ts`). Antes de tocar una API de Next, lee `node_modules/next/dist/docs/`.

## Pruebas

```bash
npm test            # Vitest: precios, carrito, búsqueda, tonos, contraste, panel, recibos…
npx tsc --noEmit    # tipos
npm run build       # tipos y compilación
```

En Windows, corre Vitest desde una ruta con `C:` mayúscula; con `c:` falla.

La lógica en la base se verifica en el editor SQL de Supabase con
`supabase/tests-v4.sql` y `supabase/tests-v5.sql`. Terminan en `rollback`
(`tests-v4.sql` sí gasta números de pedido). Para comprobar que la base tiene lo
que el código espera: `node --env-file=.env.local scripts/verificar-migracion.mjs`.

## Orden de despliegue

1. **SQL primero**: `supabase/migracion-v5.sql` y `tests-v5.sql`. Es compatible
   con la web anterior. Si la web sale antes, el catálogo responde 500.
2. **Web después**: merge a `master` y Vercel publica.
3. **Departamentos al final**: `supabase/migracion-v5-departamentos.sql`. Antes de
   publicar la web, la versión vieja los mostraría vacíos.

Para revertir los departamentos: `supabase/revertir-v5.sql`. El resto de la v5 se
queda, porque la web vieja funciona con ello. Detalle y orden completo en
[supabase/README.md](supabase/README.md).

## Cómo está organizado

```
src/app/(tienda)/         Tienda: catálogo, ficha, bolsa, pedido, mis pedidos, privacidad
src/app/@modal/           Vista rápida del producto (ruta interceptada)
src/app/admin/            Panel: pedidos en vivo, productos, categorías, recibos…
src/app/api/              GET de catálogo, búsqueda y bolsa; diagnóstico protegido
src/components/           ui, tienda, catalogo, producto, bolsa, pedido, admin
src/lib/pricing.ts        Motor de precios por escalones (función pura)
src/lib/compra.ts         La única cuenta de compra de un producto
src/lib/cart.ts           Bolsa persistente en el navegador
src/lib/data/             Consultas con caché por etiquetas
supabase/                 Esquema, seguridad, funciones, migraciones y pruebas SQL
scripts/                  Utilidades: crear administradora, verificar, probar flujo
```

## Las reglas que sostienen el sistema

**El precio nunca lo decide el navegador.** La bolsa solo guarda producto,
variante y cantidad. El total se recalcula en PostgreSQL al confirmar.

**Confirmar un pedido es una sola operación indivisible.** Stock, precios,
inventario y pedido se guardan juntos o no se guarda nada.

**Un pedido enviado dos veces sigue siendo un pedido.** Una clave de idempotencia
hace seguro el doble toque o el reintento por mala señal.

**Lo que la bolsa muestra es lo que se envía.** Una sola función
(`reconciliarCarrito`) decide qué se puede pedir.

**Tener sesión no basta para administrar.** Solo las cuentas de la tabla
`administradores` leen pedidos y escriben.

## Scripts útiles

```bash
node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "clave"   # crea y registra la administradora
node --env-file=.env.local scripts/sembrar-ejemplo.mjs
node --env-file=.env.local scripts/probar-flujo.mjs
node --env-file=.env.local scripts/probar-seguridad.mjs
```

`scripts/cargar-catalogo-engol.mjs` solo agrega referencias nuevas, en borrador;
no modifica las que ya existen.
