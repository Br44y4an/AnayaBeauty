# Funcionalidades — Anaya Beauty (Catálogo digital)

> Documento generado escaneando todo el proyecto (2026-08-26) para no tener que
> volver a leer todo el código en cada conversación. Si el código cambia,
> actualiza este archivo en las secciones afectadas en vez de regenerarlo entero.

## Qué es

Catálogo de maquillaje pensado para vender en transmisiones en vivo de TikTok.
Las clientas entran por un QR, arman su pedido con precios que bajan según la
cantidad, y lo confirman con un código de 4 dígitos que la administradora
entrega por WhatsApp solo tras verificar el pago manualmente (Nequi/Daviplata).
No hay pasarela de pago automática: todo el cobro es manual y el código de 4
dígitos es el mecanismo de control de acceso al checkout.

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
- `subtotalPara`: precio unitario × cantidad.
- `precioDesde`: el precio unitario más bajo configurado (para "desde $X").
- `sugerenciaUpsell(escalones, cantidad)`: calcula cuánto falta para el
  siguiente escalón y cuánto se ahorraría ("suma 2 más y te salen a $8.000").

## 2. Motor de descuentos (`src/lib/discounts.ts`)

Debe coincidir "al peso" con `crear_pedido` en PostgreSQL (verificado por
`scripts/probar-descuentos.mjs`). Dos beneficios encadenados:

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

- `calcularTotales(lineas, reglas, umbralPorMayor)` → `Totales` con
  subtotalNormal, subtotalBase, porMayor, porcentaje, descuento, total,
  ahorroTotal.
- `porcentajeAplicable(subtotal, reglas)`.
- `siguienteBeneficio(...)`: calcula cuánto le falta al carrito para el
  próximo beneficio ("te faltan $12.000 para el 10%"), usado como empujón de
  ventas (upsell) en el carrito.

Ejemplo verificado: carrito de $200.000 exactos → precio por mayor baja a
$196.000 → 5% de descuento → total $186.200.

## 3. Carrito (`src/lib/cart.ts`)

Store de Zustand con persistencia en `localStorage` (`persist` +
`createJSONStorage`, key `anaya-carrito`, `version: 2` — subir versión
descarta carritos viejos incompatibles vía `migrate`).

- Nunca guarda precios, solo `{ productoId, tonoId, tonoNombre, cantidad }`.
- Identidad de una línea = producto + tono (dos tonos del mismo labial = dos
  líneas independientes; mismo tono suma cantidades).
- Acciones: `agregar`, `establecer` (cantidad absoluta, elimina la línea si
  queda en 0), `quitar`, `vaciar`, `guardarCodigo` (para el link mágico).
- Helpers: `totalUnidades`, `unidadesDeProducto` (suma entre tonos del mismo
  producto, porque el stock es compartido).

## 4. Tonos de color

Productos como labiales/sombras pueden tener `product_shades` (tabla v2):
`{ nombre, colorHex, orden }`. Si un producto tiene tonos configurados, la
clienta **debe** elegir uno antes de poder agregarlo al carrito
(`SelectorTonos.tsx` — círculos de color, accesibles con `role="radiogroup"`
y `aria-label`/nombre en texto, nunca solo color).

- El stock es del producto completo, no por tono — se reparte entre líneas.
- El tono viaja congelado (`tono_snapshot`) hasta `order_items`, el correo y
  el panel admin.

## 5. Base de datos — Supabase (`supabase/*.sql`)

Ejecutar en orden: `schema.sql` → `policies.sql` → `functions.sql` →
(`migracion-v2.sql` para tonos/descuentos) → `tests.sql` (9 comprobaciones).
Todos idempotentes.

### Tablas principales
- `categories` (con `categoria_padre_id` para subcategorías)
- `products` (`referencia` único, `stock`, `activo`, nunca se borra —
  histórico de pedidos referencia el id)
- `price_tiers` (escalones min_cantidad/precio_unitario por producto)
- `product_shades` (tonos, v2)
- `access_codes` (código char(4), `estado`: disponible/usado/anulado,
  `vence_en`; único índice parcial: solo un código "disponible" con el mismo
  número a la vez, los usados/anulados liberan el número)
- `orders` (numeración `AB-0001` autoincremental vía secuencia,
  `stock_devuelto` como bandera de idempotencia para cancelaciones,
  subtotal/descuento/porcentaje_descuento/por_mayor desde v2)
- `order_items` (snapshot de referencia/nombre/tono/precio al momento de compra)
- `store_settings` (config clave/valor, columna `publico` filtra lo que ve la
  web pública)
- `discount_rules` (monto_minimo/porcentaje, v2)
- `code_attempts` (hash con sal de IP, para rate-limit; nunca se guarda IP en claro)

### Funciones (RPC, `security definer`)
- **`crear_pedido(codigo, nombre, whatsapp, ciudad, items, ip_hash)`** — la
  función central. Versión v2 (en `migracion-v2.sql`, reemplaza la de
  `functions.sql`):
  1. Rate-limit: máx 5 intentos fallidos por `ip_hash` en 10 min → `DEMASIADOS_INTENTOS`.
  2. Valida carrito no vacío y datos completos.
  3. Bloquea el código (`for update`) → `CODIGO_INVALIDO` / `CODIGO_VENCIDO`.
  4. Primera pasada: bloquea cada producto (`for update`), valida stock
     sumando TODAS las líneas de ese producto (tonos comparten inventario) →
     `SIN_STOCK|nombre|disponible`, calcula `subtotalNormal`.
  5. Decide `por_mayor` comparando `subtotalNormal` contra
     `store_settings.umbral_por_mayor` (default 200000).
  6. Crea la fila `orders`.
  7. Segunda pasada: precio final por línea (más bajo si `por_mayor`, si no
     normal), descuenta stock, inserta `order_items` con `tono_snapshot`.
  8. Calcula `porcentaje_descuento_para(subtotalBase)` y el `descuento`.
  9. Actualiza `orders` con el desglose completo y quema el código.
  - Errores devueltos como excepciones con código: `CODIGO_INVALIDO`,
    `CODIGO_VENCIDO`, `SIN_STOCK|...`, `PRODUCTO_NO_DISPONIBLE`,
    `CARRITO_VACIO`, `DATOS_INCOMPLETOS`, `CANTIDAD_INVALIDA`,
    `DEMASIADOS_INTENTOS` — traducidos a mensajes amables en
    `src/app/confirmar/actions.ts` (`mensajeAmable`).
  - Solo `service_role` puede ejecutarla (revoke all from public).
- **`cancelar_pedido(order_id)`** — devuelve stock a `products` sumando
  `order_items`, idempotente vía bandera `stock_devuelto`, marca
  `estado='cancelado'`.
- **`generar_codigo(nota?)`** — exige `auth.uid()` (solo admins logueados).
  Genera 4 dígitos aleatorios únicos entre los "disponibles" (reintenta hasta
  100 veces), vigencia configurable vía `store_settings.horas_vigencia_codigo`
  (default 24h).
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
| `/` | Catálogo: banner, buscador (debounce 350ms), chips de categoría (con subcategorías anidadas soportadas en datos aunque el chip solo muestra principales), grilla de productos con compra directa desde la tarjeta. `revalidate = 30`. |
| `/producto/[referencia]` | Detalle de un producto: imagen grande, escalones de precio, selector de tono, selector de cantidad, upsell, botón agregar. `revalidate = 30`. |
| `/carrito` | Ver/editar el pedido armado (`VistaCarrito.tsx`), desglose de descuentos en vivo, botón "pedir código por WhatsApp", botón "confirmar". |
| `/confirmar` | Formulario: código de 4 dígitos + nombre + WhatsApp + ciudad → llama `crear_pedido`. Soporta `?codigo=XXXX` desde el link mágico. |
| `/pedido/[id]` | Pantalla de éxito: número de pedido, resumen, datos de pago (Nequi/Llave), botón "enviar comprobante por WhatsApp". `id` debe ser un UUID válido (regex) — actúa como llave de acceso sin necesitar login. `dynamic = "force-dynamic"`. |
| `/c/[codigo]` | Link mágico: `/c/4821` → redirige a `/confirmar?codigo=4821`. Es lo que la admin pega en WhatsApp tras generar un código. |
| `/api/diagnostico` | Endpoint protegido por header `x-clave-diagnostico` (env `CLAVE_DIAGNOSTICO`). Revisa variables de entorno (con huella parcial de secretos), conexión a la base, si Resend acepta la clave, y opcionalmente (`?correo=1`) envía un correo de prueba con la plantilla real. |

Componentes globales:
- `BotonFlotante.tsx`: botón "Ver mi pedido" flotante que aparece cuando hay
  unidades en el carrito, oculto en `/carrito`, `/confirmar`, `/admin/*`,
  `/pedido/*`.
- `VisorImagen.tsx`: modal de imagen a pantalla completa (Escape/click fuera
  para cerrar, bloquea scroll del body).

## 7. Panel de administración (`/admin/*`)

Protegido por `middleware.ts`: cualquier ruta bajo `/admin` sin sesión
Supabase redirige a `/admin/login`; con sesión, `/admin/login` redirige a
`/admin`. Solo existen usuarios creados a mano (sin registro abierto).

| Ruta | Descripción |
|---|---|
| `/admin/login` | Login con correo/clave (`supabase.auth.signInWithPassword`). |
| `/admin` | Lista de pedidos con tarjetas de resumen (pedidos hoy, ventas hoy, sin confirmar pago, total), filtro por estado (nuevo/pagado/enviado/cancelado), búsqueda por nombre/número/whatsapp. Se actualiza en tiempo real vía Supabase Realtime — no hay que refrescar durante un live. Cada pedido es expandible: ver líneas, cambiar estado (cancelar devuelve stock automáticamente vía `cancelar_pedido`), enlace directo a WhatsApp del cliente. |
| `/admin/codigos` | Generar código nuevo (botón), copia mensaje pre-armado con el link mágico para pegar en WhatsApp de la clienta, anular código no usado, ver historial (usado/anulado/vencido/vigente). |
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

## 8. Correo (`src/lib/email/`)

- `send-order.ts`: `enviarCorreoPedido` vía Resend. **Nunca lanza** — si el
  correo falla, solo hace `console.error`; el pedido ya está guardado y
  visible en el panel (fuente de verdad principal).
- `order-template.ts`: plantilla HTML con estilo de marca (rosa/fucsia),
  escapa todo el texto del usuario (`escapar`), desglose de descuentos solo si
  hubo beneficio, botón "Ver en el panel".
- Límite del plan gratis de Resend: 100 correos/día, 3000/mes, y solo puede
  enviar a la dirección con la que se creó la cuenta Resend
  (`anayabeauty54@gmail.com`).

## 9. CSV (`src/lib/csv.ts`)

`parsearCSV(texto)`: parser manual (respeta comillas y comas dentro de
comillas), convierte precios en formato colombiano ("$35.000" → 35000),
valida fila por fila acumulando errores sin detener el proceso, arma
escalones (1 obligatorio, 3 y 6 opcionales).

## 10. Utilidades (`src/lib/`)

- `format.ts`: `pesos(valor)` → "$27.000" (Intl.NumberFormat es-CO);
  `enlaceWhatsApp(mensaje)` → link `wa.me` con mensaje codificado;
  `WHATSAPP_NEGOCIO` hardcodeado como fallback (573228813646).
- `slug.ts`: `generarSlug` — normaliza tildes, minúsculas, guiones.
- `types.ts`: tipos centrales (`Producto`, `Categoria`, `Tono`,
  `LineaCarrito`, `Pedido`, `LineaPedido`, `EstadoPedido`, `Codigo`,
  `EstadoCodigo`).

## 11. Capa de datos (`src/lib/data/`)

- `catalog.ts`: consultas públicas (solo activos) — `obtenerProductos` (con
  filtro de categoría/búsqueda/orden por precio calculado en memoria porque
  el precio no es una columna), `obtenerProductoPorReferencia`,
  `obtenerCategorias`, `obtenerConfiguracionPublica`,
  `obtenerReglasDescuento`, `obtenerConfiguracionDePrecios`. Incluye
  `mapearProducto` (fila de Supabase → tipo `Producto`) reutilizado por el
  panel admin.
- `admin-catalog.ts`: mismas consultas pero sin filtrar por `activo` (usa
  `clienteAdmin`, ve todo).
- `codes.ts` / `orders.ts`: consultas del panel (usa `clienteAdmin`).
  `obtenerPedidoPorId` valida que el `id` tenga forma de UUID antes de
  consultar (es la llave de acceso pública a la pantalla de éxito).

## 12. Componentes de catálogo/producto (`src/components/`)

- `catalogo/`: `Encabezado` (banner estático), `Buscador` (debounce, actualiza
  querystring), `ChipsCategorias`, `GrillaProductos`, `TarjetaProducto`
  (compra directa desde la tarjeta: selector de tono compacto, +/-, muestra
  upsell — pensado para minimizar fricción durante un live). El precio que
  se pinta es siempre `precioUnitarioPara(escalones, 1)` (lo que de verdad
  cobra "Agregar" la primera vez), nunca `precioDesde` (el más barato del
  combo) — mostrar ese confundía porque no coincidía con el cobro real.
  Debajo de los controles de tono, si el producto ya tiene líneas en el
  carrito, se lista cada tono con su cantidad y subtotal por separado (se
  perdía de vista al cambiar de tono). `PanelCompra` (detalle de producto)
  tiene el mismo resumen por tono.
- `producto/`: `PanelCompra` (detalle completo con tabla de escalones),
  `SelectorTonos` (círculos accesibles), `TablaEscalones`, `SelectorCantidad`.
  Tiene test: `__tests__/PanelCompra.test.tsx`.
- `ui/`: `Boton` (3 variantes), `Iconos` (set de iconos SVG inline),
  `Insignia` (badges "agotado"/"quedan X"), `VisorImagen`.
- `carrito/BotonFlotante.tsx`.

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

- `crear-admin.mjs <correo> <clave>`: crea o actualiza un usuario del panel
  (confirmado automáticamente).
- `sembrar-ejemplo.mjs`: carga categorías y productos de ejemplo para
  desarrollo (idempotente).
- `probar-flujo.mjs`: prueba end-to-end contra la base real (crea código,
  hace pedido, verifica stock/número/quemado de código, verifica que el
  precio enviado desde el "cliente" se ignora, cancela y limpia todo).
- `probar-descuentos.mjs`: verifica que `crear_pedido` en SQL cobre EXACTAMENTE
  lo mismo que `discounts.ts` en TypeScript, para 7 escenarios (sin beneficio,
  %, por mayor + %, no-reversión del por mayor, tonos en snapshot, tonos
  comparten stock, precio no manipulable). Limpia todo al final.
- `probar-correo.mjs`: envía un correo de prueba con la plantilla real
  (independiente de la app, para diagnosticar Resend).
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

- `npm test` (Vitest): 56 pruebas sobre `src/lib/` — `pricing`, `discounts`,
  `cart`, `csv`, `format`, `slug`, `catalog-mapeo`, `order-template`, más
  `PanelCompra.test.tsx` (componente).
- `npm run build`: verificación de tipos + compilación.
- `supabase/tests.sql`: 9 comprobaciones SQL (códigos reusados, stock
  insuficiente, cancelaciones, fuerza bruta) — se corren manualmente en el
  editor SQL de Supabase.
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
