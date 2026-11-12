# Funcionalidades — Anaya Beauty (Catálogo digital)

> Documento escrito escaneando el proyecto (actualizado 2026-11-11, v5) para no
> tener que volver a leer todo el código en cada conversación. Si el código cambia,
> actualiza este archivo en las secciones afectadas en vez de regenerarlo entero.
>
> **La v5 rediseñó la tienda y el panel.** Ya está en producción
> (https://anaya-beauty-tau.vercel.app) y la base tiene aplicados
> `migracion-v5.sql` y `migracion-v5-departamentos.sql`. Si montas otro entorno,
> el orden es: SQL primero, web después, departamentos al final (ver sección 5).

## Qué es

Catálogo de maquillaje pensado para vender en transmisiones en vivo de TikTok.
Las clientas entran por un QR o un enlace de WhatsApp, arman su pedido con
precios que bajan según la cantidad, y lo confirman en el momento. No hay
pasarela de pago automática: el cobro se coordina después por WhatsApp
(Nequi/Daviplata/llave) y se verifica a mano.

**Stack:** Next.js 16 (App Router) · TypeScript · React 19 · Tailwind 4 ·
Supabase (Postgres, Auth, Storage, Realtime) · Resend (correo) · Zustand
(carrito) · qrcode · jsPDF (recibos en PDF, 100% en el navegador) · Vitest.
Todo en capa gratuita. Fuente: Figtree (`next/font/google`).

**Idioma del código:** nombres de funciones, variables, tipos y comentarios en
español (los hooks conservan el prefijo `use`). UI en español (es-CO), sin
emoji.

## Qué cambió en la v5

Las clientas decían que elegir un producto y pedir era complicado. El flujo no
era largo; fallaban la orientación y el ruido. La v5 cambia esto:

- **Cabecera fija** de 56 px con logo, búsqueda, WhatsApp y bolsa con contador.
  Desaparecen el banner (que pedía un código que ya no existe), el
  `BotonFlotante` «Ver mi pedido» y el `Encabezado` con banner.
- **7 departamentos** (pestañas fijas) en vez de 26 categorías planas, con
  subcategorías en una segunda fila.
- **Búsqueda que entiende** «usk621», «pestanas», «rimel», «brocha polvo»
  (función SQL `buscar_productos`), con sugerencias mientras se escribe.
- **Toda la tarjeta abre el producto** en una vista rápida con URL propia
  (ruta interceptada). Se va `HojaCompra` y con ella `cargarTonos` y
  `cargarMasProductos`: el tono se elige dentro de la ficha.
- **Varios tonos de una vez**: una fila por variante con su propio −/cantidad/+
  y un solo botón «Agregar N · $X». Nunca se agrupa por familia de color.
- **Bolsa agrupada por producto**, con «Deshacer», progreso al siguiente
  beneficio, formulario de 3 campos que se puede recordar y total honesto
  («Total productos» + texto de envío).
- **Pedido confirmado** abre con los datos de pago y un botón de WhatsApp con
  el mensaje completo; el pedido queda guardado en el celular («Mis pedidos»).
- **Sistema visual sobrio**: blanco, tinta casi negra y un solo acento fucsia.
- **Seguridad**: tabla `administradores` + `es_admin()` en todas las políticas
  de escritura, en el proxy y en las acciones del panel. Realtime de pedidos
  funcionando.
- **Código**: una sola lógica de compra (`compra.ts`), lecturas por GET con
  caché y etiquetas, `VistaCarrito` partido en `components/bolsa/`.
- **Panel**: pedidos en vivo con el siguiente paso como botón, productos con
  filtros y variantes por id, categorías editables, importación más segura y
  **recibos personalizables** (sección 7).
- **Importador Engol**: solo agrega referencias nuevas, en borrador. No toca
  las que ya existen.
- **Legal mínimo**: `/privacidad`, aviso junto a «Confirmar» y versión de la
  política aceptada guardada en cada pedido.

## Las reglas que sostienen el sistema

1. **El precio nunca lo decide el navegador.** El carrito del cliente solo
   guarda pares producto+variante+cantidad. El total real se recalcula en
   PostgreSQL (función `crear_pedido`) leyendo los escalones de precio desde
   la base. Un carrito manipulado no puede cambiar lo que se cobra (verificado
   en `scripts/probar-flujo.mjs` y `scripts/probar-descuentos.mjs`).
2. **Confirmar un pedido es una operación atómica.** Verificar stock, calcular
   precios, descontar inventario y guardar el pedido ocurren dentro de una sola
   función SQL (`security definer`, con `for update`). Si falla el stock, nada
   se mueve.
3. **Un pedido enviado dos veces sigue siendo un pedido.** La clave de
   idempotencia convierte el doble toque o el reintento por mala señal en una
   operación segura; el límite por dispositivo (`orders.ip_hash`) frena abusos.
4. **Lo que la bolsa muestra es lo que se envía.** Una sola función
   (`reconciliarCarrito`) decide qué se puede pedir.
5. **Tener sesión no basta para administrar.** Solo las cuentas de
   `administradores` leen pedidos y escriben.

El código de 4 dígitos se eliminó en la v4: su límite por fuerza bruta nunca
contó un intento (la excepción revertía el `insert` en `code_attempts`). La v5
no lo reintroduce ni cobra nada antes de abrir la bolsa.

---

## 1. Motor de precios por escalones (`src/lib/pricing.ts`)

Función pura, sin imports, para poder ejecutarse en cualquier contexto
(cliente, servidor, scripts). Debe coincidir exactamente con la función SQL
`precio_unitario_para` en `supabase/functions.sql`.

- `Escalon = { minCantidad, precioUnitario }`
- `precioUnitarioPara(escalones, cantidad)`: toma el escalón más alto cuyo
  mínimo no supera la cantidad pedida.
  - **La `cantidad` es la del PRODUCTO COMPLETO, sumando todas sus
    variantes**, no la de una línea suelta. Quién hace esa suma es
    `discounts.ts` (sección 2); `pricing.ts` solo recibe el número.
- `subtotalPara`: precio unitario × cantidad.
- `precioDesde`: el precio unitario más bajo configurado.
- `sugerenciaUpsell(escalones, cantidad)`: cuánto falta para el siguiente
  escalón y cuánto se ahorraría.

## 2. Motor de descuentos (`src/lib/discounts.ts`)

Debe coincidir "al peso" con `crear_pedido` en PostgreSQL (verificado por
`scripts/probar-descuentos.mjs`).

**Agrupación por producto (v3):** el escalón de una línea NO lo decide su
propia cantidad, sino la suma de todas las líneas de ese producto. Las
variantes de un mismo labial comparten inventario y escalón: Rojo x2 + Nude x1
= 3 unidades, y las tres se cobran al precio del escalón de 3. Productos
distintos NO suman entre sí.

Sobre eso van dos beneficios encadenados:

1. **Precio por mayor**: si el subtotal normal alcanza un umbral configurable
   (`store_settings.umbral_por_mayor`, default $200.000), TODOS los productos
   pasan a su precio unitario más bajo. La decisión se toma sobre el subtotal
   SIN rebajar y, una vez activada, no se revierte.
2. **Descuento por porcentaje**: reglas tipo "desde $50.000 → 5%"
   (`discount_rules`). Se aplica la regla activa de mayor monto que el carrito
   alcanza, sobre el subtotal YA ajustado por el precio por mayor.

Orden de cálculo: `subtotalNormal` → (¿≥umbral? → precio más bajo por
producto) → `subtotalBase` → aplicar % → `total`.

- `LineaCalculo = { productoId, escalones, cantidad }`.
- `calcularTotales(lineas, reglas, umbralPorMayor)` → `Totales` (subtotalNormal,
  subtotalBase, porMayor, porcentaje, descuento, total, ahorroTotal).
- `cantidadesPorProducto(lineas)`, `unitarioDeLinea(linea, lineas, porMayor)`
  (la que debe usar la interfaz para pintar precios), `porcentajeAplicable`,
  `siguienteBeneficio(...)` (alimenta «Te faltan $12.000 para el 5 % de
  descuento»).

Ejemplo verificado: carrito de $200.000 exactos → precio por mayor baja a
$196.000 → 5% de descuento → total $186.200.

## 2 bis. Compra de un producto (`src/lib/compra.ts`)

`resumenDeCompra({ escalones, stock, unidadesEnBolsa, unidadesNuevas })` es la
única cuenta de compra de la tienda. Las variantes de un producto comparten
escalón: lo nuevo se cobra al precio que alcanza junto con lo que ya está en la
bolsa. Devuelve unidades, `precioUnitario`, `subtotalNuevas`, `escalonActivo`,
`siguiente` (cuánto falta y a qué precio), `maxNuevas` (stock menos lo que ya
hay en la bolsa) y `bloqueo` (`sin-precio`, `agotado`, `sin-seleccion`,
`supera-stock`). Sin nada elegido muestra el precio de 1 unidad, no $0.

Lo usan `PanelCompra` (vía `useCompraProducto`) y `AgregarRapido` (la zona de
compra de la tarjeta usa `useCarrito` y `resumenDeCompra` directamente, sin el
hook).

## 3. Carrito (`src/lib/cart.ts`)

Store de Zustand con persistencia en `localStorage` (`persist` +
`createJSONStorage`, key `anaya-carrito`, `version: 3`). La migración de v2 a
v3 **conserva las líneas**.

- Nunca guarda precios, solo `{ productoId, tonoId, tonoNombre, cantidad }`
  (los nombres persistidos no cambiaron para no migrar el `localStorage`).
- Identidad de una línea = producto + variante.
- Acciones: `agregar`, `establecer` (elimina la línea si queda en 0),
  `quitar`, `restaurar(linea, indice)` (el «Deshacer»; no duplica si la clienta
  ya la volvió a agregar), `vaciar`, `prepararEnvio`.
- `claveEnvio` + `prepararEnvio()`: identificador del intento de compra en
  curso, que viaja hasta `crear_pedido`. **Se anula en cuanto la bolsa cambia.**
- Hooks con la convención de React: `useCarrito`, `useLineasDeProducto`,
  `useUnidadesDeProducto`, `useTotalUnidades` (suscripciones finas con
  `useShallow`: tocar un «+» no vuelve a pintar las demás tarjetas; hay una
  prueba que fija la identidad de las líneas).
- `escucharOtrasPestanas()` (montada por `SincronizarBolsa`): el `persist` no
  escucha otras pestañas, así que se rehidrata con el evento `storage`. Sin eso,
  la pestaña abierta desde WhatsApp pisaría la bolsa de la otra.

## 3 bis. Reconciliación del carrito (`src/lib/carrito/reconciliar.ts`)

Módulo puro que contrasta la bolsa guardada con lo que hay en la tienda ahora.

- `reconciliarCarrito(lineas, disponibilidad)` → `{ lineas, pedibles,
  conProblema, hayCambios }`; cada línea queda `ok` / `ajustada` / `agotada` /
  `no-disponible`. Las variantes se reconcilian por id y, si no existe, por
  nombre.
- El stock compartido entre variantes se reparte en el orden en que se
  agregaron, igual que valida `crear_pedido`.
- `explicarLinea(...)` da el mensaje sin jerga («Solo quedan 2: ajustamos la
  cantidad», «Este tono se agotó», «Este producto ya no está disponible»).
- `itemsParaPedido(carrito)` es lo único que se envía al servidor.
- `carrito/mensajes.ts`: `mensajeAmable` traduce los códigos de la base y
  señala QUÉ campo corregir.

## 4. Variantes (tonos, colores, diseños…)

Productos como labiales, sombras o cosmetiqueras tienen `product_shades`:
`{ nombre, colorHex, orden, agotado }`. Si un producto tiene variantes, la
clienta **debe** elegir al menos una para agregarlo.

- **Etiqueta por producto** (`src/lib/variantes.ts`): Tono, Color, Diseño,
  Modelo, Aroma, Largo o Paleta. Se resuelve así: la del producto → la de su
  categoría → la de su departamento → por defecto (Rostro, Ojos y cejas y
  Labios dicen «Tono»; el resto, «Color»). `pluralVariante(etiqueta, n)` da «1
  tono», «6 tonos», «4 colores», «4 paletas»…
- **La grilla no trae las variantes**: solo `num_tonos` (columna mantenida por
  disparador). La tarjeta dice «Elegir tono · 6» y abre la ficha.
- **`SelectorVariantes`**: una fila por variante (≥ 56 px) en el orden
  guardado, que es el de la foto, con stepper de 44 px. Nunca se agrupa por
  familia de color (agrupar desordenaba 24 de 26 productos de 10+ tonos). Con
  más de 12 variantes aparece «Buscar entre N tonos» (filtra conservando el
  orden). Las agotadas salen atenuadas, con «Agotado» y sin stepper. Si los
  nombres son del tipo «Tono N», avisa que «la numeración corresponde a la
  foto».
- **La foto es la leyenda**: va completa y se amplía con un toque
  (`VisorImagen`).
- **Cada tono pinta su color** (`colorDeMuestra`): el círculo sale con el
  color guardado. Solo se omite si el hex no es válido o si quedó el fucsia que
  trae el formulario (#E5308A) en un tono que no se llama fucsia ni rosado; esa
  fila deja el hueco para que los nombres queden alineados. Un producto sin
  ningún color real no pinta círculos (`tieneMuestras`). La tarjeta del
  catálogo nunca pinta muestras.
- `esNumeracionDeFoto(variantes)`: todos los nombres son «Tono N».
- **Agotado por variante** (`product_shades.agotado`): bandera, no stock. La
  dueña ya no borra tonos para marcarlos agotados (borrar renumera la foto).
  `confirmarPedido` rechaza una variante agotada o inexistente
  (`TONO_NO_DISPONIBLE`).
- `src/lib/tonos.ts` conserva `hexAHsl`, `necesitaBorde` y `filtrarTonos`.
- El stock y el escalón son del producto completo: las unidades de todas las
  variantes suman. La variante viaja congelada (`tono_snapshot`) hasta
  `order_items`, el correo y el panel.

## 5. Base de datos — Supabase (`supabase/*.sql`)

Ejecutar en orden: `schema.sql` → `policies.sql` → `functions.sql` →
`migracion-v2.sql` → `migracion-v3.sql` → `migracion-v4.sql` → `tests-v4.sql`
(12 comprobaciones) → **`migracion-v5.sql`** → `tests-v5.sql` (11
comprobaciones) → publicar la web v5 → **`migracion-v5-departamentos.sql`**.
Todos son idempotentes y los tests terminan en `rollback`. `tests-v4.sql` sí
gasta números de pedido; `tests-v5.sql` no. `tests.sql` está obsoleto.

La migración v5 es compatible hacia atrás (la web v4 sigue funcionando). Los
departamentos van después porque la web vieja los mostraría vacíos.
`revertir-v5.sql` deja las categorías planas y borra los 7 departamentos; las
columnas, funciones y políticas de la v5 se quedan.

**Antes de desplegar**, `node --env-file=.env.local scripts/verificar-migracion.mjs`
dice si a la base le falta algo (no escribe nada). Si la web sale antes que el
SQL, el catálogo responde 500.

Estado de producción: v5 aplicada; 26 categorías y 370 productos tras
`migracion-v5-departamentos.sql`.

### Tablas principales
- `categories` (con `categoria_padre_id`, máximo dos niveles; v5: `etiqueta_variante`)
- `products` (`referencia` único, `stock`, `activo`, nunca se borra; v4:
  `precio_desde`, `precio_base`, `num_tonos` mantenidas por disparador; v5:
  `destacado`, `etiqueta_variante`)
- `price_tiers` (escalones min_cantidad/precio_unitario por producto)
- `product_shades` (variantes; v5: `agotado`)
- `orders` (numeración `AB-0001`, `stock_devuelto`, desglose de descuento,
  `ip_hash`, `clave_idempotencia` única parcial, `notas_cliente`; v5:
  `politica_version` y `politica_aceptada_en`)
- `order_items` (snapshot de referencia/nombre/variante/precio al comprar)
- `store_settings` (clave/valor; `publico` filtra lo que ve la web). Claves
  que escribe el panel: `mensaje_exito`, `umbral_por_mayor`, `pago_metodo`,
  `pago_numero`, `pago_titular`, `whatsapp_negocio`, `envio_info`.
- `discount_rules` (monto_minimo/porcentaje)
- `administradores` (v5): `user_id` con RLS y sin políticas; solo se lee por
  `es_admin()`.
- `access_codes` y `code_attempts`: **en desuso desde la v4**; no se borran
  porque pedidos viejos las referencian.

### Funciones (RPC)
- **`crear_pedido(nombre, whatsapp, ciudad, notas, items, ip_hash, clave)`**
  (`security definer`, solo `service_role`; v4, sin cambios en la v5):
  1. Reintento seguro: si `clave` ya existe, devuelve ESE pedido con
     `repetido: true`.
  2. Límite por dispositivo: máximo 6 pedidos por `ip_hash` en 10 minutos →
     `DEMASIADOS_PEDIDOS`.
  3. Valida carrito y datos.
  4. Bloquea cada producto (`for update`), suma TODAS sus líneas y valida stock
     → `SIN_STOCK|nombre|disponible`. Esa suma elige el escalón.
  5. Decide `por_mayor` contra `umbral_por_mayor`.
  6. Crea `orders`, inserta `order_items` con snapshot, descuenta stock,
     calcula `porcentaje_descuento_para` y guarda el desglose.
  - Errores: `SIN_STOCK`, `PRODUCTO_NO_DISPONIBLE`, `SIN_PRECIO`,
    `CARRITO_VACIO`, `DATOS_INCOMPLETOS`, `CANTIDAD_INVALIDA`,
    `DEMASIADOS_PEDIDOS`. `crear_pedido` no conoce las variantes: esa
    validación vive en `confirmarPedido`.
- **`productos_del_carrito(ids)`** (`security definer`, `anon` puede
  ejecutarla, es de solo lectura): referencia, nombre, foto, stock, `activo` y
  escalones, incluso de productos ocultos, para poder decirle a la clienta QUÉ
  se cayó de su bolsa.
- **`normalizar(text)`** (v5, inmutable: quita tildes y pasa a minúsculas) y
  **`buscar_productos(p_grupos text[], p_categorias uuid[])`** (v5,
  `security invoker`, `stable`, ejecutable por anon): un producto activo
  coincide si cada grupo tiene alguna alternativa en
  `normalizar(nombre ‖ referencia ‖ descripcion ‖ categoría ‖ departamento ‖
  nombres de variantes)` o en la referencia compacta (sin separadores). Acota
  a 10 alternativas y 120 caracteres.
- **`es_admin()`** (v5, `security definer`, `stable`): true solo si el usuario
  está en `administradores`. Revocada a `public` y `anon`.
- **`cancelar_pedido(order_id)`**: devuelve el stock sumando por producto
  (`group by product_id`), idempotente vía `stock_devuelto`.
- **`cambiar_estado_pedido(order_id, estado)`** (v5, solo `service_role`):
  transiciones válidas nuevo→pagado, nuevo→enviado, pagado→enviado,
  pagado→nuevo, enviado→pagado, nuevo|pagado→cancelado (delega en
  `cancelar_pedido`); `cancelado` es final. Lanza `TRANSICION_INVALIDA`.
- `validar_dos_niveles` (disparador de categorías), `refrescar_precios_producto`,
  `tocar_precios_producto`, `tocar_num_tonos` (mantienen las columnas
  calculadas), `precio_unitario_para`, `precio_mas_bajo`,
  `porcentaje_descuento_para`.
- `generar_codigo`: en desuso desde la v4.

### Row Level Security (`policies.sql` + v5)
- Lectura pública (`anon`, `authenticated`) solo de categorías/productos
  activos, sus escalones y tonos, reglas activas y `store_settings` con
  `publico=true`.
- Desde la v5, las políticas `*_admin` de categories, products, price_tiers,
  product_shades, discount_rules, store_settings, orders, order_items y
  access_codes usan `using ((select public.es_admin()))`; igual las de
  `storage.objects` del bucket `productos` (insert/update/delete). Una cuenta
  nueva con sesión no ve pedidos ni escribe (`tests-v5.sql` lo prueba).
- `rls_auto_enable()` ya no es ejecutable por anon ni authenticated.
- Sin política para `anon` en `orders`, `order_items`, `access_codes` y
  `code_attempts`: el único acceso público es por funciones `security definer`.

### Permisos de las funciones RPC
Supabase concede `EXECUTE` a `anon` y `authenticated` por defecto, y ese permiso
es DIRECTO: `revoke ... from public` no lo quita. Estado actual:

| función | quién puede ejecutarla |
|---|---|
| `crear_pedido` | solo `service_role` |
| `cancelar_pedido` | solo `service_role` |
| `cambiar_estado_pedido` | solo `service_role` |
| `es_admin` | `authenticated` (no `anon`) |
| `productos_del_carrito`, `buscar_productos`, `normalizar` | `anon` también (solo lectura) |

`scripts/probar-seguridad.mjs` ataca la base con la clave anónima. Correrlo
tras cualquier cambio en funciones o políticas. Las funciones llevan
`search_path` fijo.

- Desactivar «Allow new users to sign up» en Supabase Auth sigue siendo tarea
  manual (y activar la protección de contraseñas filtradas).

### Storage y Realtime
- Bucket público `productos` para imágenes (lectura pública; escritura y
  borrado solo administradoras).
- Realtime publica `orders` (la v5 hace `alter publication supabase_realtime
  add table`): el panel ve los pedidos nuevos sin recargar.

---

## 6. Rutas públicas (clientas)

Todas las páginas de la tienda viven en `src/app/(tienda)/`; el catálogo va en
`(tienda)/(catalogo)/` (ver «404 real» abajo). El layout de la tienda pinta
`Encabezado`, el contenido, `Pie`, `BusquedaRapida`, `Avisos` y
`SincronizarBolsa`.

| Ruta | Descripción |
|---|---|
| `/` | Catálogo: franja de beneficios generada de las reglas, campo de búsqueda (celular), pestañas de departamentos fijas bajo la cabecera, chips de subcategorías, barra de resultados («Labios · 43 productos» + orden), riel «Destacados» (solo sin filtros ni búsqueda), grilla de 24 en 24 con «Ver más productos» y «Viendo 48 de 372». Dinámico por `searchParams`, con datos desde caché. |
| `/producto/[referencia]` | Ficha completa (ISR, `revalidate = 300`, `generateStaticParams` vacío). Desde la tienda, el mismo enlace abre la vista rápida. Un producto inexistente da 404 real. |
| `/carrito` | **La compra entera**: bolsa + datos + confirmación (`VistaBolsa`). |
| `/confirmar`, `/c/[codigo]` | Redirecciones a `/carrito` desde `next.config.ts` (enlaces viejos en chats de WhatsApp). |
| `/pedido/[id]` | Pedido confirmado: cómo pagar, qué sigue y resumen. `id` debe ser UUID. `noindex`. Dinámico. |
| `/mis-pedidos` | Pedidos confirmados desde este celular (viven en `localStorage`). |
| `/privacidad` | Privacidad (Ley 1581) y condiciones de compra (Ley 1480). Versión «2026-11-10» en `lib/legal.ts`; la identidad legal (NIT, dirección) la completa la dueña y lo que esté en `null` no se muestra. |
| `/api/catalogo` | GET «Ver más» (`categoria`, `orden`, `q`, `pagina`). `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. |
| `/api/buscar` | GET sugerencias (máx. 8, referencia exacta primero). Mismo `Cache-Control`. |
| `/api/bolsa` | GET datos frescos de la bolsa (`ids`, máx. 60 UUID válidos). `no-store`. |
| `/api/diagnostico` | Protegido por la cabecera `x-clave-diagnostico` (env `CLAVE_DIAGNOSTICO`, comparada con `timingSafeEqual`). Sin clave correcta responde 404. Revisa variables (con huella parcial de secretos), base y, solo con `?correo=1`, envía un correo de prueba. |

Las lecturas públicas van por GET o por componentes de servidor; el único
Server Action público es `confirmarPedido`.

### Catálogo

- **Pestañas de departamentos** (`PestanasDepartamentos`, 44 px, fijas bajo la
  cabecera): «Todo» y los departamentos, con la activa subrayada y centrada. Con
  categorías planas (sin madres) muestran las raíces. Son `<Link scroll={false}>`:
  funcionan con Atrás y se comparten por WhatsApp.
- **`ChipsSubcategorias`**: «Todo en Labios», «Lip gloss»…
- **Orden** (`BarraResultados`, `<select>` nativo): Recomendados, Precio: menor
  a mayor, Precio: mayor a menor, Más nuevos.
- **`ListaProductos`**: tandas de 24, botón explícito (no scroll infinito),
  máximo 10 páginas, protección contra doble toque y duplicados. Deja la
  página en la URL con `history.replaceState` (`?pagina=N`); el servidor pinta
  las páginas 1..N si llega con ese parámetro, así volver de un producto no
  pierde lo cargado.
- **`TarjetaProducto`** (`memo`, subgrid de 5 filas): toda la tarjeta es un
  `<Link>` a la ficha. Muestra categoría, nombre, «Ref.», «$8.000 c/u», «3 o
  más: $7.500 c/u» (solo si hay un escalón al alcance del stock), acción y
  estado («2 en tu bolsa», «Quedan 3»). Sin insignia «Combo», sin lupa.
- **`AgregarRapido`**: con variantes es un enlace «Elegir tono · 6»; sin
  variantes, «Agregar» (agrega 1, vibra, muestra el aviso) y luego un stepper
  compacto; bajar a 0 quita con «Deshacer». Agotado: etiqueta sobre la foto y
  sin botón. Sin precio: «Precio por confirmar».
- **`RielDestacados`**: hasta 12 productos marcados `destacado`.
- **`EstadoVacio`**: «No encontramos productos para "x"», con departamentos y
  WhatsApp. Un `categoria` que no existe da vacío, no el catálogo entero.

### Búsqueda

- `BusquedaRapida` (montada una vez por el layout): pantalla completa en el
  celular, diálogo en escritorio. Debounce de 200 ms, mínimo 2 caracteres,
  sugerencias con miniatura, nombre, «Ref.» y precio. Enter abre el producto
  si la referencia coincide exacta («usk621» = «USK-621»); si no, `/?q=`. Se
  cierra con Escape y con Atrás (`useHistorialHoja`).
- `lib/data/busqueda.ts`: `normalizarTexto`, `gruposDeBusqueda(q)` (quita
  palabras vacías, singulariza, máx. 5 grupos, sinónimos como rimel|mascara|
  pestanina, blush|rubor, gloss|brillo, neceser|cosmetiquera, y el texto sin
  separadores como alternativa para referencias) y `nivelDeCoincidencia`.
  `filtroBusqueda` (para el panel) escapa la coma y los comodines de `ilike`.
- **Relevancia**: en «Recomendados» con búsqueda, el orden se calcula en TS por
  nivel de coincidencia (trae hasta 240 resultados; «gloss» abría con cepillos
  y ahora abre con lip gloss). **Sin foto al final de cada página**, también en
  Recomendados sin búsqueda. Las búsquedas no se cachean.
- Una RPC con `.select()` solo se puede ordenar por columnas de ese select
  (si no, PostgREST responde 42703): por eso las búsquedas piden el select de
  la grilla más `orden`, `created_at` y `precio_base`.

### La ficha (vista rápida y página)

- **Vista rápida**: ruta interceptada `src/app/@modal/(.)producto/[referencia]`
  (con `@modal/default.tsx` que da `null`). `ModalProducto` es una hoja a
  pantalla completa en celular y un diálogo de máx. 1040 px en escritorio. Se
  cierra con `router.back()` protegido contra el doble toque; si el producto
  no existe muestra «Este producto ya no está disponible» + Cerrar.
- **`FichaProducto`** (servidor) + **`PanelCompra`** (cliente): foto completa
  (toque = ampliar), categoría, nombre, «Ref.», `PreciosPorCantidad` con el
  escalón vigente resaltado («Puedes mezclar tonos: cuentan juntos para el
  precio»), selector de variantes o cantidad, «En tu bolsa», descripción y
  `RielRelacionados` («Más de {categoría}», máx. 8). `BarraFicha` lleva cerrar
  y compartir (`navigator.share` o copiar enlace).
- **Pie fijo**: «Agregar 3 · $22.500». Sin selección dice «Elige un tono» y
  enfoca la lista con «Elige al menos un tono»; nunca queda deshabilitado sin
  explicación. Al agregar: vibra 15 ms, muestra el aviso y limpia la selección;
  en el modal además cierra.
- El selector va en una columna también en el diálogo de escritorio (la
  columna de compra mide unos 400 px y no cabrían dos filas con stepper).
- Metadatos propios por producto (el catálogo circula por WhatsApp).
- **404 real**: `notFound()` solo responde 404 si ocurre fuera de todo
  `<Suspense>`. Por eso la ficha no tiene `loading.tsx` y el catálogo se movió a
  `(tienda)/(catalogo)/` (su `loading.tsx` ya no envuelve a la ficha). Un
  producto inexistente da 404 y `not-found.tsx` dice «Este producto ya no está
  disponible».
- **URL malformada**: una dirección como `/producto/100%25` o `/producto/%E0%A4%A`
  responde 500 del enrutador de Next («failed to decode param») antes de llegar
  a la página; ninguna referencia real lleva `%`, y no se amplió el proxy a
  `/producto` para no pasar cada prefetch por él.

### La bolsa (`/carrito`)

`VistaBolsa` orquesta; las piezas viven en `components/bolsa/`:

- `useBolsa`: pide `/api/bolsa` solo cuando el carrito ya se hidrató (nada de
  llamadas vacías), reconcilia, calcula totales y ofrece `reintentar()` real.
- `GrupoProducto` y `LineaVariante`: miniatura 64 px, nombre (enlace a la
  ficha), «Ref.», precio unitario aplicado, y una fila por variante con
  stepper (mínimo 1) y papelera. Quitar muestra «Quitaste Tono 3 · Deshacer».
- `AvisoCambios` y avisos por línea (stock). `ProgresoBeneficio`: barra +
  «Te faltan $12.000 para el 5 % de descuento».
- `ResumenBolsa`: Subtotal, Descuento, **Total productos** y «Envío:
  {envio_info}».
- `FormularioDatos` (`useDatosFormulario`): Nombre, WhatsApp (acepta espacios y
  +57), Ciudad, «Agregar una nota (opcional)» y «Recordar mis datos en este
  celular» (desmarcada por defecto; usa `lib/celular.ts`). Aviso legal y «Aquí
  no pagas nada todavía».
- `BarraConfirmar`: barra fija con el total; con campos vacíos dice «Completar
  mis datos» y enfoca el primero; completa: «Confirmar pedido · $45.000».
- `PantallaConfirmando`, `BolsaVacia` («Ver el catálogo» + pedidos recientes),
  `PedidosRecientes`: si hay un pedido de las últimas 12 horas en el celular,
  avisa «Ya hiciste el pedido AB-0098 hoy» y el nuevo viaja como **adicional**
  (`[Adicional a AB-xxxx]` antepuesto a la nota).
- `useConfirmarPedido`: navega y vacía la bolsa dentro del propio manejador
  (primero se marca el estado, para que no parpadee «bolsa vacía»).
- Panel sin `sticky` en escritorio: con el formulario es más alto que la
  pantalla, fijo escondería el botón.

### `confirmarPedido` (`(tienda)/carrito/actions.ts`)

Validaciones antes del RPC: nombre ≤ 80, ciudad ≤ 60, WhatsApp de 7 a 15
dígitos, nota ≤ 300, máx. 40 líneas, 1–50 por línea y 150 unidades en total
(`PEDIDO_MUY_GRANDE`: «escríbenos por WhatsApp»), variantes vigentes y sin
agotar. Después de crear el pedido: guarda `politica_version` y
`politica_aceptada_en` (solo la primera vez), invalida la etiqueta `catalogo`
con `revalidateTag("catalogo", "max")` y manda el correo dentro de `after()`.
Un reintento (`repetido: true`) no invalida ni envía correo otra vez.

### Pedido confirmado (`/pedido/[id]`)

- Cabecera: check, «¡Pedido confirmado!», «Pedido AB-0098» grande, `mensaje_exito`
  como línea secundaria. **La página respeta el estado**: en `pagado`/`enviado`
  no muestra «Cómo pagar» y marca los pasos cumplidos; en `cancelado` dice
  «Pedido cancelado» y que no hay que pagarlo (quien vuelve desde «Mis
  pedidos» no debe ver «Transfiere $124.000» de un pedido ya despachado).
- `TarjetaPago`: «Transfiere $45.000 por {método}», número con «Copiar número»
  (si el método es una llave, «Copiar llave»), titular, «Copiar valor» y envío.
  Botón primario «Ya pagué: enviar comprobante» → WhatsApp del negocio con el
  mensaje completo y el enlace del pedido (`window.location.origin`).
- `PasosPedido` (3 pasos), `ResumenPedido` (productos agrupados, desglose, «Total
  productos»), «Volver al catálogo».
- **`GuardarPedido` guarda solo al llegar desde «Confirmar»**
  (`/pedido/{id}?nuevo=1`, y luego quita el parámetro con `replaceState`), no en
  cualquier visita: si guardara al montar, el celular de la dueña acumularía los
  pedidos de las clientas al abrir el enlace del comprobante, y su bolsa diría
  «Ya hiciste el pedido…». Máx. 20 pedidos guardados (`anaya-pedidos`).
- `lib/data/pedido-publico.ts`: solo lo que la clienta ya conoce (sin notas
  internas, IP ni claves).

### Componentes globales

- `Encabezado` (cabecera fija de 56 px), `BotonBolsa` (contador con
  `aria-label «Bolsa, 3 unidades»`), `BarraBeneficios`, `Pie` (Mis pedidos,
  Privacidad, WhatsApp, SIC), `MisPedidos`, `SincronizarBolsa`.
- `Avisos` + `lib/avisos.ts` (`mostrarAviso`, `cerrarAviso`): un aviso a la
  vez, `role="status"`, 5 s, con pausa por puntero y foco; acción «Ver bolsa»
  o «Deshacer».
- `ui/`: `Boton` (+ `BotonEnlace`, `estilosBoton`), `Campo`, `Stepper`, `Hoja`
  (trampa de tabulador, Escape, devolución del foco, bloqueo de scroll),
  `VisorImagen` (pellizco y doble toque, hasta 2×), `Esqueleto`, `Giro`,
  `Iconos` (set de línea propio, WhatsApp es el único relleno), `Insignia`,
  `Marca` (logotipo recortado de `logo.jpeg` en `public/marca/anaya-beauty.png`).
- Hooks: `useCompraProducto`, `useBolsa`, `useConfirmarPedido`,
  `useBloquearScroll`, `useHistorialHoja` (Atrás cierra la hoja en vez de sacar
  a la clienta de la tienda; los enlaces dentro de la hoja navegan con
  `replace`), `usePresencia`.
- Pantallas de error: `error.tsx` («Algo no cargó bien», reintentar sin
  recargar, WhatsApp), `global-error.tsx` (colores de `lib/marca.ts`),
  `not-found.tsx`, y `loading.tsx` con esqueletos de la forma de lo que viene.
- `opengraph-image.png` 1200×630 con el logo completo.

## 7. Panel de administración (`/admin/*`)

Protegido por `src/proxy.ts` (Next 16 renombró `middleware` a `proxy`): sin
sesión **y sin fila en `administradores`** (`rpc("es_admin")`), toda ruta bajo
`/admin` redirige a `/admin/login`. Cada página, lectura y acción vuelve a
llamar `exigirAdmin()` (`lib/admin/sesion.ts`, cacheado por petición; falla
cerrado). Solo existen usuarios creados a mano.

Navegación (`NavegacionPanel`): barra inferior en celular con Pedidos (con
contador de nuevos), Productos, Recibos y Más; lateral en escritorio;
`aria-current`. El panel tiene `loading.tsx` y `error.tsx` propios.

| Ruta | Descripción |
|---|---|
| `/admin/login` | Login con correo/clave. |
| `/admin` | Pedidos **en vivo** (`PedidosEnVivo`, Realtime sobre `orders`) con indicador «En vivo / Reconectando», refresco al volver a la pestaña, el pedido nuevo resaltado y contador en el título. Cada tarjeta muestra el siguiente paso como botón («Confirmar pago» si nuevo, «Marcar enviado» si pagado), «Cancelar» aparte (con confirmación y guardia contra doble toque), «Cobrar por WhatsApp», «Avisar envío» y «Recibo» (`/admin/recibos?pedido=id`). Los estados pasan por `cambiar_estado_pedido`. KPIs del día en hora de Bogotá, aparte del filtro. La nota «[Adicional a AB-xxxx]» se ve destacada. |
| `/admin/productos` | Lista con filtros (Todos, Activos, Ocultos, Agotados, Sin foto, Destacados), categoría y búsqueda; en cada fila «Ocultar/Mostrar» y «Destacar»; volver conserva `?q=`; aviso «Guardado». |
| `/admin/productos/[id]` (incluye `nuevo`) | Formulario: referencia, nombre, descripción, categoría, etiqueta de variante («Según la categoría»), destacado, imagen, escalones, editor de variantes con interruptor «Agotado», subir/bajar y guardado por id (actualiza, inserta y borra; nunca borra todo para reinsertar). Valida todo antes de escribir. Eliminar solo dentro de la ficha, con confirmación. |
| `/admin/productos/importar` | Importador CSV con resumen de cambios antes de confirmar. En referencias existentes solo actualiza columnas con valor (una celda vacía nunca borra ni pone en 0) y nunca toca `activo`. Columnas: `referencia,nombre,descripcion,categoria,stock,precio_1,precio_3,precio_6`; una referencia nueva necesita nombre y `precio_1`. Plantilla en `public/plantilla-productos.csv`. |
| `/admin/categorias` | Lista editable: nombre (el slug no cambia), madre (solo departamentos), orden (subir/bajar), etiqueta de variante, activar/ocultar y número de productos. |
| `/admin/descuentos` | Umbral de precio por mayor y reglas por porcentaje. |
| `/admin/recibos` | Recibos personalizables (abajo). |
| `/admin/configuracion` | Ajustes con lista fija de claves: método/número/titular de pago, WhatsApp del negocio (validado: 57 + 10 dígitos), mensaje de éxito, umbral y «Información de envío» (`envio_info`, ≤ 300; por defecto «El envío se coordina por WhatsApp después de confirmar tu pedido.»). La tienda usa `whatsapp_negocio` con la constante `WHATSAPP_RESPALDO` como respaldo. |
| `/admin/qr` | QR en alta resolución, corrección «H», módulos oscuros, apuntando a `urlSitio()` + `/?o=qr` (el parámetro marca las visitas que llegan por QR). |

- **Acciones**: contrato único `Resultado<T> = { ok: true } | { ok: false;
  error }` y `Boton cargando`. Todas llaman `exigirAdmin()` primero y usan
  `clienteAdmin` (se salta RLS) después. Cada escritura invalida su caché
  pública (`lib/data/invalidar.ts`: `invalidarCatalogo`, `invalidarPrecios`,
  `invalidarConfig`, con `expire: 0`), también en un fallo parcial al guardar un
  producto.
- **Fotos**: se comprimen en el navegador (JPEG 0,85, lado máx. 1600 px, sin
  metadatos) antes de subir; límite de 5 MB (`imagen.ts`); error real en
  pantalla; la foto anterior se borra del bucket al reemplazar. Subir y borrar
  van por `clienteAdmin` tras comprobar la sesión, y `subirImagen` **devuelve**
  el error en vez de lanzarlo (una excepción en un Server Action llega al
  navegador como «Minified React error #441»).
- Enlaces del panel a la tienda usan `<a target="_blank">` para no abrir la
  vista rápida sobre el panel. Fechas con `timeZone: "America/Bogota"`.

### Recibos personalizables

> Nota: se escribió según la ficha de la Tarea 12 mientras otro agente
> terminaba el código; revisa los nombres de archivo contra `src/app/admin/(panel)/recibos/`.

Arma un recibo y lo descarga como PDF con la identidad de marca. Sigue sin
crear pedidos ni descontar stock, y no guarda nada en la base.

1. **Dirigido a**, editable en los dos modos: nombre (obligatorio), documento
   o NIT, WhatsApp, ciudad y dirección (opcionales). «Desde un pedido» lo
   rellena con los datos del pedido y se puede cambiar (el recibo puede ir a
   nombre de otra persona o empresa); «Volver a los datos del pedido» lo
   restaura.
2. **Productos en texto libre**: descripción, cantidad y precio unitario, para
   envíos, productos fuera del catálogo o servicios. En el PDF salen sin
   referencia.
3. **Personalizar**: título (por defecto «Recibo»; ≤ 40, p. ej. «Cuenta de
   cobro»), número (editable), fecha (por defecto hoy en Bogotá, editable), nota
   al pie (≤ 400, varias líneas) y la casilla «Mostrar los datos de pago».
   Título, nota y casilla se recuerdan en este navegador (`localStorage`,
   clave `anaya-recibo-preferencias`, con try/catch) y hay «Restablecer».
4. **Totales**: las líneas del catálogo y del pedido conservan su cálculo
   (escalones, por mayor, porcentaje y los ajustes manuales). Las líneas de
   texto se suman **después del descuento**: no cuentan para el porcentaje ni
   para el precio por mayor.
5. **Vista previa** en pantalla con los mismos datos del PDF, «Descargar PDF»
   (deshabilitado con explicación si falta el nombre o no hay líneas) y
   «Compartir» si el navegador soporta `navigator.canShare({ files })`.
6. **PDF** (`src/lib/pdf/recibo.ts`, jsPDF en el navegador): título
   personalizado, bloque «Dirigido a» sin huecos ni «null», nota con ajuste de
   ancho, datos de pago solo si la casilla está marcada y salto de página
   correcto.

La lógica pura y probada vive en `src/lib/admin/recibo.ts` (`Destinatario`,
`LineaTexto`, `PreferenciasRecibo`, `destinatarioDePedido`, `validarLineaTexto`,
`totalesDeRecibo`, `leerPreferencias`/`guardarPreferencias`, `reciboListo`). La
interfaz se parte en piezas dentro de `recibos/` con un hook `useRecibo`.

## 8. Correo (`src/lib/email/`)

- `send-order.ts`: `enviarCorreoPedido` vía Resend. **Nunca lanza** (el pedido ya
  está guardado) pero **sí informa**: devuelve `ResultadoCorreo`
  (`{ok:true, id}` | `{ok:false, motivo}`) y registra el motivo. El SDK de
  Resend NO lanza cuando la API rechaza el envío, devuelve `{ data: null,
  error }`; sin mirarlo, un 403 o un 429 se perdían en silencio.
- `order-template.ts`: plantilla HTML con colores solo de `PALETA`
  (`lib/marca.ts`), sin emoji, escapa todo el texto del usuario, «Descuento
  5 %», «Total productos», «Ref.», la **nota de la clienta** y el botón al
  panel (`/admin?q=<número>`) con el origen desde el que se confirmó (cabecera
  `Origin` de la acción, con respaldo en `NEXT_PUBLIC_SITE_URL`).
- **Modo prueba de Resend** (causa habitual de «no llegan los correos»):
  mientras no haya dominio verificado, el remitente es `onboarding@resend.dev`
  y Resend **solo entrega a la dirección dueña de la cuenta**. Cualquier otro
  `CORREO_DESTINO` recibe un 403 `validation_error`. Para otra dirección hay
  que verificar un dominio en resend.com/domains y cambiar el `from`.
- Límite del plan gratis: 100 correos/día, 3000/mes (cabeceras
  `x-resend-daily-quota` y `x-resend-monthly-quota`).

## 9. CSV (`src/lib/csv.ts`, `src/lib/admin/importacion.ts`)

`parsearCSV(texto)`: parser manual (respeta comillas), precios en formato
colombiano ("$35.000" → 35000), valida fila por fila acumulando errores.
`planImportacion` decide qué haría el archivo sin escribir nada (nuevos,
cambios, sin cambios y avisos: referencia repetida, precio por cantidad más caro
que el de 1, categoría inexistente, textos demasiado largos).

## 10. Utilidades (`src/lib/`)

- `format.ts`: `pesos`, `fechaCorta`, `fechaHora` (es-CO, hora de Bogotá).
- `whatsapp.ts`: `enlaceWhatsApp(mensaje, numero?)`, `normalizarWhatsapp`,
  `WHATSAPP_RESPALDO`.
- `rutas.ts`: `rutaProducto`, `decodificarReferencia` (decodifica una sola vez,
  con try/catch), `ordenDeParametro`, `urlCatalogo`.
- `sitio.ts`: `urlSitio()` = `NEXT_PUBLIC_SITE_URL` → URL de producción de
  Vercel → `http://localhost:3000` (QR, `metadataBase`, enlaces absolutos).
- `categorias.ts`: `arbolDeCategorias`, `idsDeCategoria` (la categoría y sus
  hijas), `departamentoDe`.
- `celular.ts`: datos y pedidos guardados en el celular (`anaya-datos`,
  `anaya-pedidos`), siempre con try/catch.
- `ids.ts` (`esUuid`), `dispositivo.ts` (`vibrar`), `clave-segura.ts`
  (`clavesIguales`), `color.ts` (luminancia y contraste), `marca.ts` (`PALETA`
  para correo, PDF y `global-error`), `imagen.ts`, `imagen-navegador.ts`,
  `slug.ts`, `legal.ts`, `types.ts`.

## 11. Capa de datos (`src/lib/data/`)

- `publico.ts` (en `supabase/`): cliente anon **sin cookies**; todas las
  lecturas públicas lo usan, así las páginas se pueden cachear.
- `etiquetas.ts`: `ETIQUETA = { catalogo, precios, config }` y
  `VERSION_DATOS = "v5"` (súbela si cambia la forma de los datos cacheados).
- `catalogo.ts`: `unstable_cache` (revalidate 300) para categorías, páginas sin
  búsqueda, destacados, ficha por referencia (además en React `cache()`) y
  relacionados. `obtenerProductos` pagina en la base (`POR_PAGINA = 24`,
  `count: "exact"`, `.range()`), ordena por `precio_base` con desempate por `id`
  y limita a 10 páginas y 80 caracteres de búsqueda. La grilla no trae variantes
  (`num_tonos`); la ficha sí (`CAMPOS_FICHA`). Errores: nunca devolver vacío en
  silencio, lanzar y dejar que `error.tsx` ofrezca reintentar. También
  `mapearProducto`, `obtenerSugerencias`, `obtenerRelacionados`.
- `configuracion.ts`: `obtenerConfiguracionPublica()` tipada (mensaje de éxito,
  umbral, WhatsApp, `envioInfo`, pago) y `obtenerConfiguracionDePrecios()`.
- `bolsa.ts`: `obtenerDatosBolsa(ids)` (RPC `productos_del_carrito` + variantes
  + reglas), sin caché.
- `pedido-publico.ts`, `orders.ts` (panel, `clienteAdmin`), `admin-catalog.ts`
  (sin filtrar por `activo`), `errores.ts` (`falla`).
- `paginacion.ts`: `traerTodas(consultar)` pide por páginas de 1000 porque
  PostgREST recorta a su `max-rows` sin error (con 591 productos, 76 desaparecían
  del buscador del recibo).
- `invalidar.ts`: ver sección 7.

## 12. Sistema visual y accesibilidad

El público son personas jóvenes **y mayores de 40**, en celular y muchas veces
en la calle.

- **Tokens** en `globals.css` (`@theme`): `fondo` #ffffff, `superficie`
  #f7f3f5, `tinta` #261c22, `tinta-suave` #6d5765, `linea`, `borde` #8e7d88
  (≥ 3:1), `acento` #d11a72 (relleno de la acción principal, 5,12:1 con blanco),
  `acento-hondo`, `firma` #8956b8 (solo la etiqueta de categoría), `ahorro`,
  `alerta`, `error` (cada uno con su `-fondo`) e `inactivo`. Un solo acento
  fucsia; sin Playfair ni Nunito.
- **`contraste.test.ts`** lee `globals.css` y comprueba los pares reales (AA en
  texto, borde ≥ 3:1, blanco sobre acento y acento-hondo, tinta-suave sobre
  inactivo…). Si alguien «aviva» la marca, la prueba se cae.
- **Tipografía**: Figtree, base de 16 px (nunca menos en campos: por debajo,
  Safari en iPhone hace zoom solo), `tabular-nums` en precios y cantidades;
  nada por debajo de 12 px.
- **Objetivos táctiles** de 44 px como mínimo. **Zoom permitido**
  (`maximumScale: 5`). `touch-action: manipulation` quita el retardo del toque.
- Foco visible siempre (anillo acento); «Saltar al contenido» y «Saltar a los
  productos»; `aria-live` en cantidades y totales; `role="alert"` en errores;
  etiquetas visibles y errores junto al campo con `aria-describedby`.
- Nada de `<a><button>`: los enlaces con aspecto de botón usan `BotonEnlace`.
  El stepper y los textos de ayuda no usan opacidad para atenuar.
- Movimiento de 120 a 220 ms, anulado con `prefers-reduced-motion`; hover solo
  bajo `@media (hover: hover)`. Sombras planas: solo `shadow-flotante` (avisos)
  y `shadow-hoja`.
- Sin emoji ni «princesa»; textos cortos; la única exclamación del recorrido es
  «¡Pedido confirmado!».

## 13. Autenticación (`src/lib/supabase/`)

- `client.ts`: cliente de navegador (anon key), usado para Realtime en el panel.
- `server.ts`: cliente de servidor con cookies; respeta RLS. Queda para el panel.
- `publico.ts`: cliente anon sin cookies, `server-only`, para las lecturas
  públicas.
- `admin.ts`: cliente con `SUPABASE_SERVICE_ROLE_KEY` (`server-only`, se salta
  RLS): capa admin de datos, `crear_pedido`, `cancelar_pedido` y
  `cambiar_estado_pedido`.
- `src/proxy.ts`: refresca la sesión, comprueba `es_admin` y protege
  `/admin/:path*`.

## 14. Scripts (`scripts/*.mjs`, ejecutar con `node --env-file=.env.local`)

- **`verificar-migracion.mjs`**: comprueba que la base tenga lo que el código
  espera (migraciones v4 y v5) y avisa de ajustes de seguridad pendientes. No
  escribe nada. Correr antes de desplegar.
- `crear-admin.mjs <correo> <clave>`: crea o actualiza un usuario del panel
  (confirmado) **y lo registra en `administradores`** (sin esa fila no ve
  pedidos ni la web lo deja entrar).
- `sembrar-ejemplo.mjs`: categorías y productos de ejemplo para desarrollo.
- `probar-flujo.mjs`: prueba end-to-end contra la base real (pedido sin código,
  stock, reintento seguro, precio no manipulable, rechazos, nota y
  cancelación). Crea y destruye su propio producto `TEST-FLUJO`.
- `probar-descuentos.mjs`: verifica que `crear_pedido` cobre EXACTAMENTE lo mismo
  que `discounts.ts` en 9 escenarios. Limpia todo al final.
- `probar-seguridad.mjs`: ataca la base con la clave anónima (ver sección 5).
- `probar-correo.mjs`: correo de prueba con la plantilla real, independiente de
  la app.
- `probar-e2e-correo.mjs`: prueba a través de la app (requiere `next dev`):
  dispara el server action `confirmarPedido` por HTTP, leyendo los ids de
  `.next/dev/server/app/carrito/page/server-reference-manifest.json`. Nota: tras
  mover la tienda a `(tienda)/`, confirma que esa ruta del manifiesto siga
  existiendo antes de contar con él.
- `probar-mejora-imagen.mjs`: **piloto/experimental**, no toca producción
  (Gemini, requiere `GEMINI_API_KEY`).
- `cargar-catalogo-engol.mjs`: importador masivo desde `Catalogo_Engol.xlsx`
  (requiere `unzip`). Crea categoría padre = hoja y subcategoría = columna
  «Categoria», sube fotos a `productos/catalogo-engol/` y **solo agrega
  referencias nuevas**, en borrador (`activo=false`, `stock=0`, sin precios):
  usa `upsert` con `ignoreDuplicates: true` y las fotos con `upsert: false`. Las
  referencias que ya están en la base no se tocan (ni foto, ni nombre, ni
  stock, ni visibilidad). **No es un «actualizar»**: para cambiar productos
  existentes usa el panel o su importador CSV.
- `generar-marca.mjs`: recorta el logotipo de `logo.jpeg` a
  `public/marca/anaya-beauty.png` y crea `opengraph-image.png` (requiere
  `sharp`, que está en devDependencies).
- `_piloto-imagenes/generar-favicon.mjs`: genera `favicon.ico`, `icon.png` y
  `apple-icon.png`; requiere `sharp` y `png-to-ico` (no están en
  `package.json`).

## 15. Pruebas

- **`npm test` (Vitest): 867 pruebas en 92 archivos** (eran 211 en la v4; las
  de recibos pueden sumar más cuando termine la Tarea 12). Entorno `node` por
  defecto; `// @vitest-environment jsdom` solo en pruebas de componentes. En
  Windows córrelo con la ruta `C:/Users/...` (con `c:` minúscula falla por doble
  carga).
  - `src/lib/`: `pricing`, `discounts`, `cart` (incluye `restaurar` y la
    garantía de identidad), `compra`, `variantes`, `categorias`, `busqueda`,
    `reconciliar`, `mensajes`, `celular`, `avisos`, `rutas`, `sitio`, `csv`,
    `format`, `slug`, `imagen`, `imagen-navegador`, `storage`, `paginacion`,
    `catalogo-consultas`, `catalogo-mapeo`, `bolsa-datos`, `pedido-publico`,
    `orders-datos`, `configuracion`, `send-order`, `order-template`,
    `recibo-pdf`, `contraste`, `marca` y las del panel (`admin-*`: ajustes,
    categorías, filtros, importación, pedidos, producto, sesión, variantes,
    proxy).
  - Componentes: tarjeta, agregar rápido, pestañas, lista, búsqueda rápida,
    ficha, modal, panel de compra, selector de variantes, precios por cantidad,
    bolsa, formulario de datos, tarjeta de pago, resumen y guardado del pedido,
    avisos, hoja, stepper, botón, y del panel (navegación, pedidos en vivo,
    tabla y tarjeta de pedido, editor de variantes, importación, recibos).
  - Rutas: `bolsa`, `catalogo-buscar`, `diagnostico`, `estado-404` (un producto
    inexistente responde 404 real), error global, acciones de carrito y panel.
- `npm run build`: tipos + compilación. `npx tsc --noEmit` debe quedar limpio.
- `supabase/tests-v4.sql`: 12 comprobaciones (disparadores, motor de precios,
  pedido sin código, variantes que suman escalón, reintento seguro, atomicidad,
  límite por dispositivo, cancelación idempotente).
- `supabase/tests-v5.sql`: 11 comprobaciones en una transacción con `rollback`:
  `normalizar`, `buscar_productos` («usk621», «pestanas», «brocha polvo»),
  categorías de dos niveles, etiquetas y columnas nuevas, `es_admin`, que una
  cuenta nueva no administra nada, `cancelar_pedido` con dos tonos del mismo
  producto, `cambiar_estado_pedido`, `envio_info` y `mensaje_exito`, que toda
  escritura exige `es_admin()` y que Realtime publica `orders`.
- `scripts/verificar-migracion.mjs` y `scripts/probar-seguridad.mjs`: estado y
  seguridad de la base. Los `probar-*.mjs` son pruebas de integración contra la
  base real, para correr a mano al tocar precios, descuentos o el flujo.
- Regla: nunca pulsar «Confirmar pedido» contra la base real.

## 16. Variables de entorno relevantes

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `CORREO_DESTINO`, `SAL_HASH_IP`, `CLAVE_DIAGNOSTICO` (para
`/api/diagnostico`; su valor no se escribe en ningún documento y vive solo en
Vercel y en tu `.env.local`), `GEMINI_API_KEY` (solo para el piloto de
imágenes). `VERCEL_PROJECT_PRODUCTION_URL` la pone Vercel y `urlSitio()` la usa
de respaldo.

## 17. Pendientes de la dueña o el dueño

Desactivar «Allow new users to sign up» y activar la protección de contraseñas
filtradas en Supabase Auth; rotar `CLAVE_DIAGNOSTICO` en Vercel; decidir si
siguen los 10k de «abrir bolsa» y qué son; poner el texto real de envío en
Ajustes; completar la identidad legal en `/privacidad`; limpiar tonos con la
hoja de contacto (accesorios «Tono N», hex no confiables, fotos que no cuadran,
marcar agotados con el interruptor en vez de borrar). Detalle en la sección 6
del estudio.

## 18. Cómo actualizar este documento

Cuando cambie algo estructural (nueva ruta, nueva tabla, cambio en el motor de
precios/descuentos, nuevo script), edita la sección correspondiente en vez de
regenerar todo el archivo. Si se agregan features grandes, agrega una sección
nueva siguiendo el mismo estilo. El código manda sobre este documento.
