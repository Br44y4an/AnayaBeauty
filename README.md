# Anaya Beauty — Catálogo digital

Catálogo de maquillaje pensado para vender en transmisiones en vivo de TikTok.

Las clientas entran por un QR, arman su pedido con precios que bajan según la
cantidad, y **lo confirman en el momento**, sin códigos ni esperas. El cobro se
coordina después por WhatsApp y se verifica a mano. Cada pedido llega al panel
en tiempo real y por correo.

> **v4:** desapareció el código de 4 dígitos y la bolsa y la confirmación se
> juntaron en una sola pantalla. Antes de desplegar hay que ejecutar
> `supabase/migracion-v4.sql` — ver [SETUP.md](SETUP.md).

**Guía de puesta en marcha:** [SETUP.md](SETUP.md)
**Diseño y decisiones:** [docs/superpowers/specs/](docs/superpowers/specs/)

## Stack

Next.js 16 · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Storage,
Realtime) · Resend · Vitest. Todo en capa gratuita.

## Arranque local

```bash
npm install
cp .env.example .env.local     # y completa los valores
npm run dev
```

## Pruebas

```bash
npm test            # 211 pruebas: precios, carrito, tonos, contraste, correo…
npm run build       # verificación de tipos y compilación
```

La lógica de negocio en la base de datos se verifica ejecutando
`supabase/tests-v4.sql` en el editor SQL de Supabase: 12 comprobaciones —dentro
de una transacción que termina en `rollback`, así que es seguro correrlas en
producción— que cubren precios, tonos, reintentos duplicados, stock
insuficiente, cancelaciones y límite por dispositivo.

Antes de desplegar, `node --env-file=.env.local scripts/verificar-migracion.mjs`
comprueba que la base tenga aplicado todo lo que el código espera.

## Cómo está organizado

```
src/lib/pricing.ts        Motor de precios por escalones (función pura)
src/lib/cart.ts           Carrito persistente en el navegador
src/lib/data/             Consultas a la base de datos
src/lib/email/            Plantilla y envío del aviso de pedido
src/app/                  Pantallas públicas y panel
supabase/                 Esquema, seguridad, funciones y pruebas SQL
scripts/                  Utilidades: sembrar datos, crear admin, probar flujo
```

## Las dos reglas que sostienen el sistema

**El precio nunca lo decide el navegador.** El carrito solo guarda pares de
producto y cantidad. El total se recalcula en PostgreSQL al confirmar, leyendo
los escalones desde la base. Un carrito manipulado no puede cambiar lo que se
cobra.

**Confirmar un pedido es una sola operación indivisible.** Verificar el stock,
calcular precios, descontar inventario y guardar el pedido ocurren juntos o no
ocurren. Si falla el stock, no se mueve nada.

**Un pedido enviado dos veces sigue siendo un pedido.** El navegador manda una
clave de idempotencia; si llega repetida (doble toque, reintento por mala
señal), el servidor devuelve el pedido que ya creó en vez de duplicarlo.

**Lo que el carrito muestra es exactamente lo que se envía.** Una sola función
(`reconciliarCarrito`) decide qué se puede pedir, y la usan tanto la pantalla
como el formulario.

## Scripts útiles

```bash
node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "clave"
node --env-file=.env.local scripts/sembrar-ejemplo.mjs
node --env-file=.env.local scripts/probar-flujo.mjs
```
