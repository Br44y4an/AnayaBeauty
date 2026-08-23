# Anaya Beauty — Catálogo digital

Catálogo de maquillaje con pedidos por código de un solo uso, pensado para
vender en transmisiones en vivo de TikTok.

Las clientas entran por un QR, arman su pedido con precios que bajan según la
cantidad, y lo confirman con un código de 4 dígitos que la administradora
entrega por WhatsApp solo tras verificar el pago. Cada pedido llega al panel en
tiempo real y por correo.

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
npm test            # 56 pruebas: precios, carrito, CSV, correo, formato
npm run build       # verificación de tipos y compilación
```

La lógica de negocio en la base de datos se verifica ejecutando
`supabase/tests.sql` en el editor SQL de Supabase: 9 comprobaciones que cubren
códigos reusados, stock insuficiente, cancelaciones y fuerza bruta.

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

**Confirmar un pedido es una sola operación indivisible.** Validar el código,
verificar el stock, calcular precios, descontar inventario, guardar el pedido y
quemar el código ocurren juntos o no ocurren. Si falla el stock, el código no se
gasta y el inventario no se mueve.

## Scripts útiles

```bash
node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "clave"
node --env-file=.env.local scripts/sembrar-ejemplo.mjs
node --env-file=.env.local scripts/probar-flujo.mjs
```
