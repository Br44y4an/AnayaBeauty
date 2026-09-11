# Funcionalidades — Anaya Beauty (Catálogo digital)

> Documento generado escaneando todo el proyecto (actualizado 2026-09-10) para no
> tener que volver a leer todo el código en cada conversación. Si el código cambia,
> actualiza este archivo en las secciones afectadas en vez de regenerarlo entero.
>
> **La v4 cambió el flujo de compra**: desapareció el código de 4 dígitos y la
> bolsa y la confirmación se juntaron en una sola pantalla. Antes de desplegar
> hay que ejecutar `supabase/migracion-v4.sql`.

## Qué es

Catálogo de maquillaje pensado para vender en transmisiones en vivo de TikTok.
Las clientas entran por un QR, arman su pedido con precios que bajan según la
cantidad, y lo confirman en el momento. No hay pasarela de pago automática: el
cobro se coordina después por WhatsApp (Nequi/Daviplata) y se verifica a mano.

**El código de 4 dígitos se eliminó en la v4.** Era un paso extra entre "ya
elegí" y "ya pedí": había que salir a WhatsApp, esperar la respuesta de la
administradora y volver. Tampoco era la protección que parecía — el `insert` en
`code_attempts` iba seguido de `raise exception`, y la excepción revertía la
transacción entera incluido ese insert, así que el límite por fuerza bruta
nunca llegó a contar ni un intento. En su lugar hay dos defensas que viven en
filas que sí se confirman: un límite de pedidos por dispositivo
(`orders.ip_hash`) y una clave de idempotencia que convierte el doble toque o
el reintento por mala señal en una operación segura.

**Stack:** Next.js 16 (App Router) · TypeScript · React 19 · Tailwind 4 ·
Supabase (Postgres, Auth, Storage, Realtime) · Resend (correo) · Zustand
(carrito) · qrcode · jsPDF (recibos en PDF, 100% en el navegador) · Vitest.
Todo en capa gratuita.

**Idioma del código:** nombres de funciones, variables, tipos y comentarios en
español. UI en español (es-CO).

## Las dos reglas que sostienen el sistema

1. **El precio nunca lo decide el navegador.** El carrito del cliente solo
   guarda pares producto+tono+cantidad. El total real se recalcula en
   PostgreSQL (función `crear_pedido`) leyendo los escalones de precio desde
   la base. Un carrito manipulado no puede cambiar lo que se cobra (verificado
   en `scripts/probar-flujo.mjs` y `scripts/probar-descuentos.mjs`).
2. **Confirmar un pedido es una operación atómica.** Validar el código,
   verificar stock, calcular precios, descontar inventario, guardar el pedido
   y quemar el código ocurren todos dentro de una sola función SQL
   (`security definer`, con `for update` para bloqueo de filas). Si falla el
   stock, nada se mueve.

---

## 1. Motor de precios por escalones (`src/lib/pricing.ts`)

Función pura, sin imports, para poder ejecutarse en cualquier contexto
(cliente, servidor, scripts). Debe coincidir exactamente con la función SQL
`precio_unitario_para` en `supabase/functions.sql`.

- `Escalon = { minCantidad, precioUnitario }`
- `precioUnitarioPara(escalones, cantidad)`: toma el escalón más alto cuyo
  mínimo no supera la cantidad pedida.
  - **La `cantidad` que se le pasa es la del PRODUCTO COMPLETO, sumando todos
    sus tonos** — no la de una línea suelta. Quién hace esa suma es
    `discounts.ts` (ver sección 2); `pricing.ts` solo recibe el número.
- `subtotalPara`: precio unitario × cantidad.
- `precioDesde`: el precio unitario más bajo configurado (para "desde $X").
- `sugerenciaUpsell(escalones, cantidad)`: calcula cuánto falta para el
  siguiente escalón y cuánto se ahorraría ("suma 2 más y te salen a $8.000").

## 2. Motor de descuentos (`src/lib/discounts.ts`)

Debe coincidir "al peso" con `crear_pedido` en PostgreSQL (verificado por
`scripts/probar-descuentos.mjs`).

**Agrupación por producto (v3):** el escalón de una línea NO lo decide su
propia cantidad, sino la suma de todas las líneas de ese producto. Los tonos
de un mismo labial comparten inventario y también comparten escalón: Rojo x2 +
Nude x1 = 3 unidades, y las tres se cobran al precio del escalón de 3. Antes
cada tono elegía escalón por separado y un combo repartido entre tonos nunca
se alcanzaba. Productos distintos NO suman entre sí.

Sobre eso van dos beneficios encadenados:

1. **Precio por mayor**: si el subtotal normal (con escalones normales)
   alcanza un umbral configurable (`store_settings.umbral_por_mayor`, default
   $200.000), TODOS los productos del carrito pasan a su precio unitario más
   bajo, sin importar cuántas unidades lleve de cada uno individualmente.
   - La decisión de activarlo se toma sobre el subtotal SIN rebajar, y una vez
     activado no se revierte (evita oscilación infinita).
2. **Descuento por porcentaje**: reglas tipo "desde $50.000 → 5%"
   (`discount_rules`, montoMinimo+porcentaje). Se aplica la regla activa de
   mayor monto que el carrito alcanza, sobre el subtotal YA ajustado por el
   precio por mayor.

Orden de cálculo: `subtotalNormal` → (¿≥umbral? → precio más bajo por
producto) → `subtotalBase` → aplicar % → `total`.

- `LineaCalculo = { productoId, escalones, cantidad }` — el `productoId` es lo
  que permite agrupar los tonos.
- `calcularTotales(lineas, reglas, umbralPorMayor)` → `Totales` con
  subtotalNormal, subtotalBase, porMayor, porcentaje, descuento, total,
  ahorroTotal.
- `cantidadesPorProducto(lineas)` → `Map<productoId, unidades>`: la suma que
  decide el escalón.
- `unitarioDeLinea(linea, lineas, porMayor)`: precio unitario final de una
  línea. **Es la función que debe usar la interfaz para pintar precios**, para
  no reimplementar la regla en cada pantalla.
- `porcentajeAplicable(subtotal, reglas)`.
- `siguienteBeneficio(...)`: calcula cuánto le falta al carrito para el
  próximo beneficio ("te faltan $12.000 para el 10%"), usado como empujón de
  ventas (upsell) en el carrito.

Ejemplo verificado: carrito de $200.000 exactos → precio por mayor baja a
$196.000 → 5% de descuento → total $186.200.

## 3. Carrito (`src/lib/cart.ts`)

Store de Zustand con persistencia en `localStorage` (`persist` +
`createJSONStorage`, key `anaya-carrito`, `version: 3`). La migración de v2 a v3
**conserva las líneas**: el formato no cambió y tirar la bolsa de alguien que
llevaba media hora armándola sería peor que cualquier incompatibilidad.

- Nunca guarda precios, solo `{ productoId, tonoId, tonoNombre, cantidad }`.
- Identidad de una línea = producto + tono (dos tonos del mismo labial = dos
  líneas independientes; mismo tono suma cantidades).
- Acciones: `agregar`, `establecer` (cantidad absoluta, elimina la línea si
  queda en 0), `quitar`, `vaciar`, `prepararEnvio`.
- `claveEnvio` + `prepararEnvio()`: identificador del intento de compra en
  curso. Viaja hasta `crear_pedido`, que lo guarda en `orders`. Si el mismo
  envío llega dos veces (doble toque, reintento del navegador), el servidor
  reconoce la clave y devuelve el pedido que ya creó en vez de duplicarlo y
  descontar el stock otra vez. **Se anula en cuanto la bolsa cambia**: otro
  contenido es otro pedido.
- Helpers: `totalUnidades`, `unidadesDeProducto`, `lineasDeProducto`.

### Suscripciones finas (el arreglo de "se traba")

`usarLineasDeProducto(id)`, `usarUnidadesDeProducto(id)` y `usarTotalUnidades()`.

El catálogo llegó a pintar 591 tarjetas a la vez y cada una hacía
`usarCarrito((e) => e.lineas)`: **cualquier toque en un "+" volvía a renderizar
las 591**, con sus imágenes, sus paletas y sus cálculos de precio. Ése era el
origen de la traba — no la red ni la base: el propio navegador.

`usarLineasDeProducto` usa `useShallow`, y como `agregar`/`establecer`
conservan la identidad de las líneas que no tocan, la tarjeta de un producto no
se entera de lo que pasa en otro. `TarjetaProducto` va además envuelta en
`memo`. Hay una prueba que fija esa garantía de identidad (`cart.test.ts`).

## 3 bis. Reconciliación del carrito (`src/lib/carrito/reconciliar.ts`)

Módulo puro que contrasta la bolsa guardada con lo que de verdad hay en la
tienda ahora. **Una sola respuesta a "qué se puede pedir", y las dos pantallas
la usan.**

Antes cada pantalla resolvía eso por su cuenta: `VistaCarrito` descartaba en
silencio las líneas sin stock y pintaba un total que solo contaba las que
sobrevivían, mientras que el formulario de confirmación serializaba las líneas
CRUDAS del store, descartadas incluidas. Resultado: la bolsa mostraba $80.000,
la clienta pulsaba "Confirmar" y el servidor respondía `SIN_STOCK` por un
producto que ella ya no veía en pantalla — la venta se caía en el último paso.

- `reconciliarCarrito(lineas, disponibilidad)` → `{ lineas, pedibles,
  conProblema, hayCambios }`. Cada línea queda en `ok` / `ajustada` /
  `agotada` / `no-disponible`.
- El stock compartido entre tonos se reparte en el orden en que se agregaron,
  igual que valida `crear_pedido`: un carrito que sale entero de aquí no puede
  fallar allá.
- `explicarLinea(...)` da el mensaje sin jerga ("se agotó" y "ya no está" son
  cosas distintas y la clienta merece saber cuál le pasó).
- `itemsParaPedido(carrito)` es lo único que se envía al servidor.

## 4. Tonos de color

Productos como labiales/sombras pueden tener `product_shades` (tabla v2):
`{ nombre, colorHex, orden }`. Si un producto tiene tonos configurados, la
clienta **debe** elegir uno antes de poder agregarlo al carrito.

### El rediseño de la v4 (la queja más repetida)

*"Los tonos son muchísimos"* y *"estoy obligada a ver los tonos de productos
que no quiero"*. Había productos con 30 y 40 tonos, y sus círculos se pintaban
todos, siempre, dentro de cada tarjeta del catálogo. La respuesta tiene tres
partes:

1. **Los tonos salen de la grilla.** La tarjeta solo sabe `num_tonos` (una
   columna, mantenida por disparador) y ofrece un botón "Elegir tono". Además
   de quitar el muro visual, esto saca decenas de miles de filas de la consulta
   del catálogo.
2. **La paleta vive en una hoja inferior** (`HojaCompra` sobre `ui/Hoja.tsx`),
   que se abre solo si la clienta la pide. Los tonos se piden en ese momento
   (`cargarTonos`). La hoja aparece encima del catálogo y se va: nunca se
   pierde el sitio ni el scroll, que es carísimo en mitad de un live.
3. **Dentro de la hoja la paleta se puede recorrer**: cada tono es un botón de
   44px **con su nombre debajo** (antes eran círculos de 28px sin texto); por
   encima de 10 tonos se agrupan por familia de color (Rojos, Nudes, Rosados…)
   y por encima de 12 aparece un buscador que tolera tildes. Nadie recuerda un
   código hexadecimal, pero sí que "era un rojo".

La lógica de agrupado y filtrado es pura y está en `src/lib/tonos.ts`
(`familiaDeColor`, `agruparTonos`, `filtrarTonos`, `necesitaBorde`), con
pruebas propias. `familiaDeColor` trata los **nudes** como caso especial —son
naranjas/marrones poco saturados—: sin esa regla un beige apagado caía junto a
un naranja neón y la paleta no se podía leer.

- El color nunca es el único indicador: siempre hay nombre en texto, y la marca
  de "elegido" es una palomita además del anillo.
- `necesitaBorde` pone contorno a los tonos casi blancos, que si no desaparecen
  sobre el fondo blanco y la clienta ve un hueco donde hay una opción.
- El stock es del producto completo, no por tono — se reparte entre líneas.
- **El escalón de precio también es del producto completo**: las unidades de
  todos los tonos suman para decidirlo (ver sección 2).
- El tono viaja congelado (`tono_snapshot`) hasta `order_items`, el correo y
  el panel admin.

## 5. Base de datos — Supabase (`supabase/*.sql`)

Ejecutar en orden: `schema.sql` → `policies.sql` → `functions.sql` →
`migracion-v2.sql` (tonos/descuentos) → `migracion-v3.sql` (escalón agrupado
por producto) → **`migracion-v4.sql`** (pedido sin código + columnas
calculadas) → `tests-v4.sql` (12 comprobaciones). Todos idempotentes.

> `tests.sql` quedó obsoleto: probaba el flujo con código de acceso.

**Antes de desplegar**, `node --env-file=.env.local scripts/verificar-migracion.mjs`
dice si a la base le falta algo. La v4 cambia la firma de `crear_pedido` y añade
columnas que el catálogo consulta directamente: si se despliega la web antes de
correr el SQL, el catálogo responde 500 y nadie puede pedir.

### Tablas principales
- `categories` (con `categoria_padre_id` para subcategorías)
- `products` (`referencia` único, `stock`, `activo`, nunca se borra —
  histórico de pedidos referencia el id; desde v4 `precio_desde`, `precio_base`
  y `num_tonos`, mantenidas por disparador para poder paginar y ordenar en SQL)
- `price_tiers` (escalones min_cantidad/precio_unitario por producto)
- `product_shades` (tonos, v2)
- `access_codes` y `code_attempts` — **en desuso desde la v4**. No se borran
  porque los pedidos viejos las referencian y el historial debe quedar intacto,
  pero ya nada escribe en ellas.
- `orders` (numeración `AB-0001` autoincremental vía secuencia,
  `stock_devuelto` como bandera de idempotencia para cancelaciones,
  subtotal/descuento/porcentaje_descuento/por_mayor desde v2, y desde v4:
  `ip_hash` (límite por dispositivo), `clave_idempotencia` (única, parcial:
  convierte el reenvío en algo seguro) y `notas_cliente`)
- `order_items` (snapshot de referencia/nombre/tono/precio al momento de compra)
- `store_settings` (config clave/valor, columna `publico` filtra lo que ve la
  web pública)
- `discount_rules` (monto_minimo/porcentaje, v2)
- `code_attempts` (hash con sal de IP, para rate-limit; nunca se guarda IP en claro)

### Funciones (RPC, `security definer`)
- **`crear_pedido(nombre, whatsapp, ciudad, notas, items, ip_hash, clave)`** —
  la función central. Versión v4 (en `migracion-v4.sql`; las firmas viejas se
  eliminan primero porque la nueva tiene la misma aridad y PostgreSQL no podría
  decidir cuál llamar):
  1. **Reintento seguro**: si `clave` ya existe en `orders.clave_idempotencia`,
     devuelve ESE pedido con `repetido: true` y no toca nada más. Es lo que
     hace que el doble toque en "Confirmar" no cree dos pedidos ni descuente el
     stock dos veces.
  2. **Límite por dispositivo**: máximo 6 pedidos confirmados por `ip_hash` en
     10 minutos → `DEMASIADOS_PEDIDOS`. Cuenta filas ya confirmadas, no
     intentos: el contador viejo se revertía junto con la excepción que lo
     provocaba y por eso nunca contó nada.
  3. Valida carrito no vacío y datos completos.
  4. Primera pasada: bloquea cada producto (`for update`), suma TODAS las
     líneas de ese producto (`v_cantidad_producto`, porque los tonos comparten
     inventario) y valida stock contra esa suma →
     `SIN_STOCK|nombre|disponible`. Esa misma suma es la que se le pasa a
     `precio_unitario_para` para elegir el escalón (v3), no la cantidad de la
     línea suelta. Calcula `subtotalNormal`.
  5. Decide `por_mayor` comparando `subtotalNormal` contra
     `store_settings.umbral_por_mayor` (default 200000).
  6. Crea la fila `orders`.
  7. Segunda pasada: precio final por línea (el más bajo si `por_mayor`; si
     no, el escalón de la cantidad agrupada del producto), descuenta stock,
     inserta `order_items` con `tono_snapshot`.
  8. Calcula `porcentaje_descuento_para(subtotalBase)` y el `descuento`.
  9. Actualiza `orders` con el desglose completo.
  - Errores devueltos como excepciones con código: `SIN_STOCK|nombre|quedan`,
    `PRODUCTO_NO_DISPONIBLE|nombre`, `SIN_PRECIO|nombre`, `CARRITO_VACIO`,
    `DATOS_INCOMPLETOS`, `CANTIDAD_INVALIDA`, `DEMASIADOS_PEDIDOS` —
    traducidos a mensajes amables en `src/app/carrito/actions.ts`
    (`mensajeAmable`), que además señala QUÉ campo corregir.
  - Solo `service_role` puede ejecutarla (revoke all from public).
- **`productos_del_carrito(ids)`** (v4, `security definer`) — todo lo que el
  carrito necesita de golpe: referencia, nombre, foto, stock, `activo` y
  escalones. Es `security definer` por un motivo concreto: la lectura pública
  solo ve productos con `activo = true`, así que un producto que la
  administradora ocultara desaparecía de la bolsa sin dejar ni el nombre y la
  clienta la veía encoger sola. Expone lo mínimo para poder decirle QUÉ se cayó.
- **`refrescar_precios_producto`, `tocar_precios_producto`, `tocar_num_tonos`**
  (v4) — disparadores que mantienen `products.precio_desde`, `precio_base` y
  `num_tonos`. Existen porque el precio vive en `price_tiers` y no en
  `products`: sin estas columnas no había forma de ordenar por precio ni de
  paginar en la base, y había que traer los 591 productos a memoria.
- **`cancelar_pedido(order_id)`** — devuelve stock a `products` sumando
  `order_items`, idempotente vía bandera `stock_devuelto`, marca
  `estado='cancelado'`.
- `generar_codigo(nota?)` — **en desuso desde la v4**. Sigue existiendo en la
  base (no estorba y borrarla obligaría a tocar `access_codes`), pero ya nadie
  la llama: la pantalla del panel que la usaba se eliminó.
- `precio_unitario_para`, `precio_mas_bajo`, `porcentaje_descuento_para`:
  helpers SQL puros que reflejan `pricing.ts`/`discounts.ts`.

### Row Level Security (`policies.sql`)
- Lectura pública (`anon`, `authenticated`) solo de: categorías/productos
  activos, price_tiers de productos activos, tonos de productos activos,
  reglas de descuento activas, `store_settings` con `publico=true`.
- `authenticated` (los 2 admins) tiene `for all` en todo.
- **Sin política para `anon`** en `access_codes`, `orders`, `order_items`,
  `code_attempts` — el único acceso público es a través de las funciones
  `security definer`. Esto evita que cualquiera pueda leer códigos o pedidos
  de otras personas.
### Permisos de las funciones RPC (agujero encontrado y cerrado en la v4)

Supabase concede `EXECUTE` a `anon` y `authenticated` **por defecto** sobre las
funciones del esquema `public`, y ese permiso es DIRECTO: el
`revoke ... from public` que traían las migraciones **no lo quitaba**.

Mientras existió el código de 4 dígitos daba igual —sin un código válido la
llamada no llegaba a ninguna parte—, pero al quitarlo `crear_pedido` quedó
alcanzable desde fuera con la clave anónima, la que va incrustada en el
navegador y cualquiera puede leer, por `/rest/v1/rpc/crear_pedido`. Y quien
llama directo manda `p_ip_hash` en null, así que **también se salta el límite
por dispositivo**. Como cada pedido descuenta inventario, se podía vaciar el
catálogo entero sin comprar nada.

Estado actual, verificado contra la base:

| función | quién puede ejecutarla |
|---|---|
| `crear_pedido` | solo `service_role` |
| `cancelar_pedido` | solo `service_role` |
| `generar_codigo` | solo `service_role` (en desuso) |
| `productos_del_carrito` | `anon` también — **intencional**, es de solo lectura |

`scripts/probar-seguridad.mjs` ataca la base con la clave anónima y comprueba
las dos caras: que no se pueda escribir ni leer lo ajeno, y que sí se pueda
leer el catálogo y consultar la propia bolsa. Correrlo tras cualquier cambio
en funciones o políticas.

Las funciones también llevan `search_path` fijo: sin él, quien controle su
propio `search_path` puede hacer que la función resuelva una tabla distinta de
la que cree estar leyendo.

- Registro de nuevos usuarios debe desactivarse manualmente en Supabase
  (Authentication → Providers → Email → "Enable sign ups" OFF) — de lo
  contrario cualquiera podría registrarse y entrar al panel.

### Storage
- Bucket público `productos` para imágenes (políticas de lectura pública,
  escritura/borrado solo `authenticated`).

### Realtime
- Tabla `orders` con replicación activada — el panel de pedidos se actualiza
  solo sin refrescar (`TablaPedidos.tsx` se suscribe a `postgres_changes`).

---

## 6. Rutas públicas (clientas)

| Ruta | Descripción |
|---|---|
| `/` | Catálogo: banner, buscador (debounce 350ms, con estado "buscando" y botón de borrar), chips de categoría **con subcategorías** anidadas, selector de orden, cinta de beneficios, y grilla **paginada de 24 en 24** con botón "Ver más". `revalidate = 30`. |
| `/producto/[referencia]` | Detalle: foto ampliable, escalones de precio, selector de tono con nombres, selector de cantidad, upsell, botón agregar. Metadatos propios por producto (el catálogo circula por WhatsApp y el enlace compartido debe decir de qué producto se trata). `revalidate = 30`. |
| `/carrito` | **La compra entera**: bolsa + datos + confirmación en una sola pantalla (`VistaCarrito.tsx`). Ver abajo. |
| `/confirmar` | Redirección a `/carrito`. Se conserva porque hay enlaces repartidos por chats de WhatsApp que apuntan aquí. |
| `/c/[codigo]` | Redirección a `/carrito`. Los links mágicos de códigos siguen circulando; llevan a la bolsa en vez de dar 404. |
| `/pedido/[id]` | Pantalla de éxito: número de pedido, **qué pasa ahora** (4 pasos), datos de pago con botón de copiar, resumen, botón "enviar comprobante por WhatsApp". `id` debe ser un UUID válido (regex) — actúa como llave de acceso sin necesitar login. `dynamic = "force-dynamic"`. |
| `/api/diagnostico` | Endpoint protegido por header `x-clave-diagnostico` (env `CLAVE_DIAGNOSTICO`). Revisa variables de entorno (con huella parcial de secretos), conexión a la base, si Resend acepta la clave, y opcionalmente (`?correo=1`) envía un correo de prueba con la plantilla real. |

### El checkout de una sola pantalla

El recorrido era: catálogo → bolsa → confirmar → listo, **y en medio había que
salir a WhatsApp a pedir un código, esperar respuesta y volver**. Cuatro
pantallas y una espera para comprar un labial. Ahora:

catálogo → `/carrito` (bolsa + datos + confirmar) → `/pedido/[id]`

- Indicador de pasos visible ("1 Tu bolsa · 2 Tus datos · 3 Listo").
- Barra inferior fija con el total y el botón de confirmar, que envía el
  formulario con `form="form-pedido"` (así el total acompaña a la clienta por
  toda la pantalla sin duplicar el formulario ni romper el envío con teclado).
- Aviso explícito cuando la bolsa cambió (agotados, ajustes, retirados), con
  botón "Entendido, actualizar mi bolsa". **Lo que se ve es lo que se envía.**
- Campo opcional de notas ("es un regalo", "timbre 302") que llega al correo y
  al panel.
- Sección "Qué pasa después" con los 4 pasos del proceso, para que nadie se
  quede esperando sin saber qué sigue.
- Validación con mensaje por campo (`campo: "nombre" | "whatsapp" | ...`), que
  además desplaza la pantalla hasta el aviso.
- Al confirmar se marca el estado ANTES de vaciar la bolsa: si se vaciara
  primero aparecía un parpadeo de "bolsa vacía" justo después de comprar.

### Pantallas de error (`error.tsx`, `global-error.tsx`, `not-found.tsx`)

Sin ellas, cualquier fallo del servidor dejaba una pantalla en blanco con
"Minified React error #441" y la venta se perdía ahí mismo. Ahora siempre hay
mensaje claro, botón de reintentar sin recargar y salida por WhatsApp.
`loading.tsx` pinta esqueletos con la forma de lo que viene, para que la espera
no se lea como "se trabó".

Componentes globales:
- `BotonFlotante.tsx`: botón "Ver mi pedido" que aparece cuando hay unidades en
  la bolsa, oculto en `/carrito`, `/confirmar`, `/admin/*`, `/pedido/*`. Se
  suscribe solo al TOTAL (un número), no a la lista de líneas.
- `VisorImagen.tsx`: modal de imagen a pantalla completa (Escape/click fuera
  para cerrar, bloquea scroll del body).
- `ui/Hoja.tsx`: hoja inferior reutilizable con trampa de tabulador, cierre con
  Escape, devolución del foco y bloqueo del scroll de fondo.

## 7. Panel de administración (`/admin/*`)

Protegido por `middleware.ts`: cualquier ruta bajo `/admin` sin sesión
Supabase redirige a `/admin/login`; con sesión, `/admin/login` redirige a
`/admin`. Solo existen usuarios creados a mano (sin registro abierto).

| Ruta | Descripción |
|---|---|
| `/admin/login` | Login con correo/clave (`supabase.auth.signInWithPassword`). |
| `/admin` | Lista de pedidos con tarjetas de resumen (pedidos hoy, ventas hoy, sin confirmar pago, total), filtro por estado (nuevo/pagado/enviado/cancelado), búsqueda por nombre/número/whatsapp. Cada pedido muestra la **nota de la clienta** destacada, que es lo primero que necesita quien despacha. Se actualiza en tiempo real vía Supabase Realtime — no hay que refrescar durante un live. Cada pedido es expandible: ver líneas, cambiar estado (cancelar devuelve stock automáticamente vía `cancelar_pedido`), enlace directo a WhatsApp del cliente. |
| `/admin/productos` | Lista con búsqueda, indicadores de agotado/por agotarse/oculto. Enlaces a "Nuevo producto" e "Importar CSV". |
| `/admin/productos/[id]` (incluye `nuevo`) | Formulario completo: referencia, nombre, descripción, categoría, imagen (subida a Supabase Storage, máx 5MB), escalones de precio dinámicos (con vista previa de cómo lo verá la clienta para 1/3/6/12 unidades), tonos de color dinámicos (input de color + nombre), checkbox "visible en el catálogo". Nunca borra productos (solo `activo=false`) porque pedidos históricos los referencian. |
| `/admin/productos/importar` | Importador CSV: sube archivo, parsea client-side (`csv.ts`), muestra vista previa con tabla de precios calculados, importa (upsert por referencia — reimportar el mismo archivo actualiza en vez de duplicar). Columnas: `referencia,nombre,descripcion,categoria,stock,precio_1,precio_3,precio_6` (solo precio_1 obligatorio). |
| `/admin/categorias` | Crear categorías/subcategorías (`categoria_padre_id`), reordenar (campo orden), "ocultar" (soft-delete vía `activo=false`). |
| `/admin/descuentos` | Configurar umbral de precio por mayor y reglas de descuento por porcentaje (crear/activar/desactivar/eliminar). Explica la cascada de cálculo con un ejemplo. |
| `/admin/recibos` | Arma un recibo y lo descarga como PDF con la identidad de marca (logo, colores, mensaje de agradecimiento). Dos modos: "Desde un pedido" (prellena todo con los datos ya cobrados, sin recalcular nada) o "Manual" (busca productos del catálogo, agrega líneas con tono/cantidad, y calcula el total con el mismo motor de descuentos que el carrito). El PDF se genera 100% en el navegador con `src/lib/pdf/recibo.ts` (jsPDF) — no depende de un servidor de renderizado. El modo manual no crea un pedido real ni descuenta stock. |
| `/admin/configuracion` | Ajustes editables sin tocar código: método/número/titular de pago, WhatsApp del negocio, mensaje de agradecimiento, horas de vigencia del código. Solo ciertas claves son `publico=true` (visibles en la web). |
| `/admin/qr` | Genera y descarga QR (alta resolución, corrección de error "H") apuntando a `NEXT_PUBLIC_SITE_URL`, con consejos de uso en vivo. |

Todas las acciones de escritura del panel verifican sesión (`exigirSesion` en
`acciones-pedidos.ts`) antes de usar el cliente con clave de servicio
(`clienteAdmin`), porque ese cliente se salta RLS.

**Storage:** subir y borrar imágenes también va por `clienteAdmin` (tras
comprobar la sesión). Las políticas de escritura del bucket `productos` que
describe `supabase/README.md` nunca se aplicaron a la base, así que con la
sesión del usuario `upload` devolvía "new row violates row-level security
policy" y `remove` fallaba en silencio (0 objetos, el archivo se quedaba).
Además `subirImagen` **devuelve** el error en vez de lanzarlo: una excepción
dentro de un Server Action llega al navegador como "Minified React error
#441", con el mensaje real borrado por React en producción.

## 8. Correo (`src/lib/email/`)

- `send-order.ts`: `enviarCorreoPedido` vía Resend. **Nunca lanza** — el
  pedido ya está guardado y visible en el panel (fuente de verdad principal)
  — pero **sí informa**: devuelve `ResultadoCorreo`
  (`{ok:true, id}` | `{ok:false, motivo}`) y registra el motivo con
  `console.error`.
  - **Por qué devuelve resultado y no `void`:** el SDK de Resend NO lanza
    cuando la API rechaza el envío, devuelve `{ data: null, error }`. El
    `try/catch` original solo atrapaba fallos de red, así que un rechazo de
    la API (el 403 de abajo, un 429, un destinatario suprimido) se perdía en
    silencio: la administradora se quedaba sin avisos y sin ninguna señal de
    por qué. Verificado en `__tests__/send-order.test.ts`.
- `order-template.ts`: plantilla HTML con estilo de marca (rosa/fucsia),
  escapa todo el texto del usuario (`escapar`), desglose de descuentos solo si
  hubo beneficio, botón "Ver en el panel". Desde la v4 lleva la **nota de la
  clienta** en lugar del antiguo "código usado" — algo que de verdad le sirve a
  quien despacha. Los colores del correo también se ajustaron al contraste AA.
- **Restricción del modo prueba de Resend (la causa habitual de "no llegan
  los correos"):** mientras no haya un dominio verificado, el remitente es el
  compartido `onboarding@resend.dev` y Resend **solo entrega a la dirección
  dueña de la cuenta** (`anayabeauty54@gmail.com`). Cualquier otro valor de
  `CORREO_DESTINO` recibe un 403 `validation_error`:
  *"You can only send testing emails to your own email address"*. Para enviar
  a otra dirección hay que verificar un dominio en resend.com/domains y
  cambiar el `from`.
- Límite del plan gratis de Resend: 100 correos/día, 3000/mes. La respuesta
  de la API trae el uso acumulado en las cabeceras `x-resend-daily-quota` y
  `x-resend-monthly-quota`.

## 9. CSV (`src/lib/csv.ts`)

`parsearCSV(texto)`: parser manual (respeta comillas y comas dentro de
comillas), convierte precios en formato colombiano ("$35.000" → 35000),
valida fila por fila acumulando errores sin detener el proceso, arma
escalones (1 obligatorio, 3 y 6 opcionales).

## 10. Utilidades (`src/lib/`)

- `imagen.ts`: `validarImagen` / `rutaDeImagen` para las fotos de producto. La
  ruta en el bucket es siempre `uuid.extension`: el nombre original trae
  espacios y hasta barras ("WhatsApp Image 2026-08-31 at 7.21.50 PM.jpeg").
- `format.ts`: `pesos(valor)` → "$27.000" (Intl.NumberFormat es-CO);
  `enlaceWhatsApp(mensaje)` → link `wa.me` con mensaje codificado;
  `WHATSAPP_NEGOCIO` hardcodeado como fallback (573228813646).
- `slug.ts`: `generarSlug` — normaliza tildes, minúsculas, guiones.
- `types.ts`: tipos centrales (`Producto`, `Categoria`, `Tono`,
  `LineaCarrito`, `Pedido`, `LineaPedido`, `EstadoPedido`, `Codigo`,
  `EstadoCodigo`).

## 11. Capa de datos (`src/lib/data/`)

- `catalog.ts`: consultas públicas (solo activos). Dos decisiones de la v4:
  - **La grilla no trae los tonos.** Un producto puede tener 40 y con 591
    productos eran decenas de miles de filas por pantalla para pintar unos
    círculos que casi nadie quería mirar. Solo viaja `num_tonos`; los tonos se
    piden con `obtenerTonosDeProducto` al abrir la hoja.
  - **La grilla se pagina en la base** (`POR_PAGINA = 24`, `count: "exact"`,
    `.range()`). Antes se traía la tabla entera para poder ordenarla por precio,
    porque el precio vive en `price_tiers`; las columnas `precio_desde` /
    `precio_base` de la v4 dejan que PostgreSQL ordene y corte. Hay desempate
    estable por `id`: sin él, dos productos con el mismo precio pueden cambiar
    de sitio entre página y página y salir repetidos o perdidos.
  - Un `categoriaSlug` que no existe devuelve lista vacía, no el catálogo
    completo (que haría pensar que el filtro no funciona).
  - También: `obtenerProductoPorReferencia`, `obtenerCategorias`,
    `obtenerConfiguracionPublica`, `obtenerReglasDescuento`,
    `obtenerConfiguracionDePrecios`, y `mapearProducto` (fila de Supabase →
    tipo `Producto`) reutilizado por el panel admin.
- `busqueda.ts`: `filtroBusqueda(texto, columnas)` — arma el argumento de
  `.or()` de PostgREST. Hay **dos** trampas en la misma cadena:
  1. *La coma.* En `or(...)` separa condiciones, así que el término crudo hacía
     que buscar "base, matte" devolviera "failed to parse logic tree": la
     consulta lanzaba y la página moría con un 500 ("Minified React error
     #441" en el navegador). Se resuelve entrecomillando el valor.
  2. *Los comodines de LIKE.* `%` y `_` son comodines de `ilike`, no texto:
     buscar "50%" traía todo lo que empezara por "50", y "A_1" traía también
     "A11" y "AB1". Ahora se escapan (la barra invertida primero, o escaparía
     los escapes siguientes).

  Lo usan los tres buscadores: catálogo público, productos del panel y pedidos
  del panel.
- `paginacion.ts`: `traerTodas(consultar)` — pide la tabla por páginas de 1000
  con `.range()` hasta agotarla. Existe porque PostgREST recorta toda respuesta
  a su `max-rows` **sin devolver error**: `obtenerProductos` y
  `listarProductosAdmin` tenían un `.limit(500)` fijo y, con 591 productos
  cargados, 76 productos con precio desaparecían del buscador del recibo manual
  sin ninguna señal. Toda consulta que deba devolver el catálogo completo pasa
  por aquí; cada página arma su propia consulta porque los builders de PostgREST
  son mutables y de un solo uso.
- `admin-catalog.ts`: mismas consultas pero sin filtrar por `activo` (usa
  `clienteAdmin`, ve todo).
- `orders.ts`: consultas del panel (usa `clienteAdmin`). `obtenerPedidoPorId`
  valida que el `id` tenga forma de UUID antes de consultar (es la llave de
  acceso pública a la pantalla de éxito). `codes.ts` se eliminó con la v4.

## 12. Componentes de catálogo/producto (`src/components/`)

- `catalogo/`:
  - `Encabezado` (banner; se recorta en celular con `max-h-[38vh]` porque a su
    proporción original no cabía ni un producto en la primera pantalla).
  - `CintaBeneficios`: dice arriba del todo cómo se ahorra (escalones, precio
    por mayor, % extra). Los descuentos solo se descubrían al llegar al
    carrito, cuando ya estaba todo elegido; saberlo antes cambia lo que la
    clienta mete en la bolsa, y además es lo honesto.
  - `Buscador` (debounce 350ms, indicador de "buscando", botón de borrar;
    reinicia a la primera tanda al cambiar el término).
  - `ChipsCategorias` (con segunda fila de subcategorías: antes existían en los
    datos pero no había forma de llegar a ellas, así que una tienda de 591
    productos solo se podía filtrar en bloques enormes). Son enlaces de verdad,
    no botones con JavaScript: funcionan con el botón atrás y se pueden
    compartir por WhatsApp, que es como circula este catálogo.
  - `OrdenProductos`: `<select>` **nativo** a propósito — abre la rueda del
    sistema con el tamaño de letra que la persona tenga configurado y funciona
    con teclado y lector de pantalla sin reimplementar nada. Ordenar por precio
    existía en el código pero no había ningún control para usarlo.
  - `ListaProductos`: la grilla por tandas de 24 con botón "Ver más" y contador
    ("Viendo 24 de 591"). Botón explícito y no scroll infinito: con scroll
    infinito nunca se llega al pie y no se sabe cuánto falta. Protege contra
    duplicados si se toca dos veces seguidas.
  - `TarjetaProducto` (`memo`): compra directa desde la tarjeta para productos
    sin tonos; botón "Elegir tono" que abre la hoja para los que sí tienen.
    **Ya no pinta la paleta.** El precio que se pinta es el que de verdad se
    está cobrando: `precioUnitarioPara(escalones, max(1, unidadesEnLaBolsa))` —
    nunca `precioDesde`, que confundía porque no coincidía con el cobro. La
    hoja y el visor se cargan con `next/dynamic` al abrirlos.
- `producto/`:
  - `PanelCompra` (detalle: aquí sí caben los tonos en línea, es una sola
    pantalla y hay sitio de sobra).
  - `HojaCompra`: tono + cantidad + precio en vivo + lo que ya lleva, sobre la
    hoja inferior. Carga los tonos al abrirse; si un producto tiene un solo
    tono, se da por elegido y la clienta se ahorra un toque.
  - `SelectorTonos`: botones de 44px con nombre debajo, agrupados por familia y
    con buscador cuando la paleta es larga.
  - `FotoProducto`, `TablaEscalones`, `SelectorCantidad`.
  - Pruebas: `PanelCompra.test.tsx`, `SelectorTonos.test.tsx`.
- `ui/`: `Boton` (4 variantes, 2 tamaños, estado `cargando` con giro y
  `aria-busy`), `Iconos` (SVG inline), `Insignia`, `VisorImagen`, `Hoja`,
  `Esqueleto`.
- `carrito/BotonFlotante.tsx`.

## 12 bis. Accesibilidad y legibilidad

El público de esta tienda son personas jóvenes **y mayores de 40**, en celular
y muchas veces en la calle. Lo que se corrigió:

- **Contraste.** La paleta original fallaba WCAG AA (4.5:1) en los dos
  sentidos: texto rosa sobre blanco 4.10, texto lila sobre blanco 3.17 y —el
  más caro— **texto blanco sobre el rosa del botón principal, 4.10**. "Agregar"
  y "Confirmar" son los dos botones de los que vive la tienda. Ahora
  `--color-fucsia: #d11a72` (5.12 con blanco encima) y `--color-lila: #8956b8`
  (5.14). El rosa original queda como `fucsia-vivo`, solo para adornos sin
  texto: la marca no cambia de color, cambia de profundidad donde hace falta
  leer.
- **`contraste.test.ts` lee `globals.css`** y comprueba los colores que la web
  usa de verdad. Si alguien "aviva" la marca otra vez, la prueba se cae y dice
  cuánto contraste perdió.
- **Tamaños.** Nada por debajo de 12px; base de 16px reales en `body` (por
  debajo, Safari en iPhone hace zoom solo al enfocar un campo y descoloca la
  pantalla). Se eliminaron todos los `text-[10px]` y `text-[11px]`.
- **Objetivos táctiles** de 44px como mínimo, 52px en los botones principales.
- **Zoom permitido** (`maximumScale: 5`): para quien no ve de cerca, poder
  ampliar es la diferencia entre poder comprar y no poder.
- `touch-action: manipulation` quita el retardo de ~300ms del toque, que hacía
  que cada botón "respondiera tarde" y la clienta lo pulsara dos veces.
- Foco visible siempre; enlace "Saltar al catálogo"; `aria-live` en cantidades,
  totales y estados de búsqueda; `role="alert"` en los errores.
- Toda animación por debajo de 300ms y anulada con `prefers-reduced-motion`.

## 13. Autenticación (`src/lib/supabase/`)

- `client.ts`: cliente de navegador (`createBrowserClient`, anon key) — usado
  para Realtime en el panel.
- `server.ts`: cliente de servidor (`createServerClient`, anon key, maneja
  cookies) — respeta RLS, usado en Server Components/Actions que actúan "como
  el usuario".
- `admin.ts`: cliente con `SUPABASE_SERVICE_ROLE_KEY` (`server-only`, se salta
  RLS) — usado en la capa admin de datos y en `crear_pedido`/`cancelar_pedido`.
- `src/proxy.ts` (antes `middleware.ts` — Next 16 renombró la convención;
  la función exportada se llama `proxy`, no `middleware`): refresca sesión y
  protege `/admin/:path*`.

## 14. Scripts (`scripts/*.mjs`, ejecutar con `node --env-file=.env.local`)

- **`verificar-migracion.mjs`**: comprueba que la base tenga aplicado todo lo
  que el código espera (columnas, funciones, coherencia de `precio_desde`). No
  escribe nada. **Correr antes de desplegar**: la v4 cambia la firma de
  `crear_pedido`, así que desplegar la web antes que el SQL deja la tienda
  cerrada, no degradada.
- `crear-admin.mjs <correo> <clave>`: crea o actualiza un usuario del panel
  (confirmado automáticamente).
- `sembrar-ejemplo.mjs`: carga categorías y productos de ejemplo para
  desarrollo (idempotente).
- `probar-flujo.mjs`: prueba end-to-end contra la base real — pedido sin
  código, stock, **reintento seguro** (la misma clave no duplica ni descuenta
  dos veces), precio no manipulable, rechazo por stock y por datos
  incompletos, nota de la clienta, y cancelación. Crea y destruye su propio
  producto `TEST-FLUJO`: antes usaba `REF-101` del sembrado de ejemplo y
  fallaba entero con `PRODUCTO_NO_DISPONIBLE` en cuanto ese producto quedaba
  oculto desde el panel, sin que hubiera nada roto.
- `probar-descuentos.mjs`: verifica que `crear_pedido` en SQL cobre EXACTAMENTE
  lo mismo que `discounts.ts` en TypeScript, para 9 escenarios (sin beneficio,
  %, por mayor + %, no-reversión del por mayor, tonos en snapshot, tonos
  comparten stock, **tonos suman para el escalón**, **productos distintos no
  suman entre sí**, precio no manipulable). Limpia todo al final.
- `probar-correo.mjs`: envía un correo de prueba con la plantilla real
  (independiente de la app, para diagnosticar Resend).
- `probar-e2e-correo.mjs`: prueba end-to-end **a través de la app**, no del
  RPC. Requiere `next dev` corriendo. Dispara el server action
  `confirmarPedido` por HTTP igual que el navegador (lee los ids de action de
  `.next/dev/server/app/carrito/page/server-reference-manifest.json` — desde la
  v4 el action vive en `/carrito` — y codifica los argumentos con el
  `encodeReply` de React; enviar un `FormData` suelto devuelve "Connection
  closed"). Comprueba que el pedido se guarde, que cobre el escalón correcto,
  que la nota llegue y que la clave de idempotencia quede guardada. Existe
  porque `probar-flujo.mjs` llama a `crear_pedido` directamente y por eso nunca
  ejercitaba el server action ni el envío del correo. Limpia todo al final.
- `probar-mejora-imagen.mjs`: **piloto/experimental**, no toca producción.
  Descarga 3 fotos del catálogo Engol ya subidas, las manda a Gemini
  (`gemini-3-pro-image-preview`, alias "Nano Banana Pro") pidiendo mejora de
  calidad profesional en 4K sin alterar el producto, guarda resultado en
  `scripts/_piloto-imagenes/` para revisión manual antes de aplicarlo a más
  fotos. Requiere `GEMINI_API_KEY`.
- `cargar-catalogo-engol.mjs`: **importador masivo** desde `Catalogo_Engol.xlsx`
  (archivo en la raíz del proyecto, no versionado normalmente). Extrae el
  .xlsx como zip (requiere `unzip` en PATH), parsea XML de hojas específicas
  (`Accesorios`, `Cosmeticos`, `Natacion`), extrae imágenes incrustadas por
  fila, crea categoría padre = nombre de hoja + subcategoría hija = columna
  "Categoria", sube imágenes al bucket `productos/catalogo-engol/`, crea/
  actualiza productos en modo **borrador** (`activo=false`, `stock=0`, sin
  precios) para completar manualmente desde el panel. Maneja referencias
  duplicadas en el Excel sufijándolas. Reporta filas con el logo de Engol
  detectado en la foto (hoja `Logo_en_producto`) para revisión. Es seguro
  reejecutar (upsert por referencia).
- `_piloto-imagenes/generar-favicon.mjs`: recorta el logo (detecta el círculo
  sólido descartando el glow/sombra) y genera `favicon.ico`, `icon.png`,
  `apple-icon.png` en `src/app/`. Requiere `sharp` y `png-to-ico` (no están en
  `package.json` — instalación puntual/manual).

## 15. Trabajo en curso / archivos no versionados (al momento de este escaneo)

Según `git status`, estos archivos existen en el working tree pero no están
commiteados — parecen ser una migración de catálogo real en curso (marca
"Engol"), separada del negocio "Anaya Beauty":

- `Catalogo_Engol.xlsx` — fuente de datos para `cargar-catalogo-engol.mjs`.
- `logo.jpeg` — posible logo nuevo/alternativo.
- `scripts/cargar-catalogo-engol.mjs`, `scripts/probar-mejora-imagen.mjs`.
- `scripts/_piloto-imagenes/*-original.jpeg` — fotos de muestra descargadas
  por el piloto de mejora de imagen (EUP-632, SO1909, SY-9502).

Esto sugiere una tarea en progreso de: (1) importar un catálogo de productos
real desde Excel con fotos incrustadas, y (2) evaluar mejorar esas fotos con
IA antes de publicarlas. Ninguno de los dos scripts toca datos de producción
de forma destructiva (el importador crea todo en borrador; el de imágenes solo
lee y guarda localmente).

## 16. Pruebas

- **`npm test` (Vitest): 211 pruebas** (eran 122). Sobre `src/lib/`:
  `pricing`, `discounts`, `cart` (incluida la garantía de identidad de líneas
  de la que depende el rendimiento), `csv`, `format`, `slug`, `catalog-mapeo`,
  `order-template`, `paginacion` (regresión del tope de 500 productos),
  `busqueda` (regresión de la coma **y** de los comodines de LIKE), `imagen`,
  `storage`, `send-order` (regresión del correo que fallaba en silencio), y las
  nuevas:
  - `reconciliar` — que lo que muestra el carrito sea exactamente lo que se
    envía al servidor;
  - `tonos` — familias de color, filtrado sin tildes, agrupado sin pérdidas;
  - `contraste` — **lee `globals.css`** y comprueba que la paleta real cumpla
    WCAG AA.

  De componente: `PanelCompra.test.tsx`, `SelectorTonos.test.tsx`,
  `TarjetaProducto.test.tsx` (incluye que la grilla NO pinte la paleta).
- `npm run build`: verificación de tipos + compilación.
- `supabase/tests-v4.sql`: 12 comprobaciones SQL dentro de una transacción que
  termina en `rollback` — se puede correr en producción sin miedo. Cubre
  disparadores, motor de precios, pedido sin código, tonos que suman escalón,
  productos que no suman entre sí, reintento seguro, precio no manipulable,
  atomicidad del stock, límite por dispositivo, cancelación idempotente y nota
  de la clienta. (`tests.sql` quedó obsoleto.)
- `scripts/verificar-migracion.mjs`: estado de la base antes de desplegar.
- `scripts/probar-seguridad.mjs`: ataca la base con la clave anónima del
  navegador y comprueba que no se pueda crear pedidos, cancelar, leer datos de
  otras clientas ni tocar el inventario.
- Los scripts `probar-*.mjs` son pruebas de integración contra la base real
  (no mockeada), pensadas para correrse manualmente cuando se toca la lógica
  de precios/descuentos/flujo.

## 17. Variables de entorno relevantes

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `CORREO_DESTINO`, `SAL_HASH_IP`, `CLAVE_DIAGNOSTICO`
(para `/api/diagnostico`), `GEMINI_API_KEY` (solo para el piloto de imágenes).

## 18. Cómo actualizar este documento

Cuando cambie algo estructural (nueva ruta, nueva tabla, cambio en el motor de
precios/descuentos, nuevo script), edita la sección correspondiente en vez de
regenerar todo el archivo. Si se agregan features grandes, agrega una sección
nueva siguiendo el mismo estilo (una tabla o lista con la ruta/archivo y qué
hace).
