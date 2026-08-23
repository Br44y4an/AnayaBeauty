# Anaya Beauty — Catálogo digital con pedidos por código

Fecha: 2026-08-22
Estado: diseño aprobado, pendiente plan de implementación

## 1. Objetivo de negocio

Anaya Beauty vende maquillaje en vivo por TikTok. Las espectadoras escanean un
código QR, exploran el catálogo y arman un pedido. Para confirmarlo necesitan un
código de 4 dígitos que la administradora entrega por WhatsApp únicamente después
de verificar que la clienta transfirió los 10.000 COP de "abrir bolsa".

El código es el filtro anti-pedidos-falsos. La web debe eliminar la fricción de
ese filtro sin eliminar el filtro.

Contacto de la marca: WhatsApp +57 313 255 3660.
Correo de la administradora: anayabeauty54@gmail.com.
Dirección web: anayabeauty.vercel.app.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Momento del código | Navegación y carrito libres. El código se pide solo al confirmar. |
| Entrega del código | Link mágico `/c/{codigo}` que autoaplica el código con un toque desde WhatsApp. |
| Vida del código | Un solo uso estricto. Se quema al confirmar el pedido. |
| Datos de la clienta | Nombre, WhatsApp y ciudad. |
| Stock | Se descuenta al confirmar. Cancelar el pedido lo devuelve automáticamente. |
| Precios | Escalones por cantidad: el sistema busca el escalón que aplica y multiplica. |
| Catálogo | Más de 150 productos: categorías, subcategorías, buscador y filtros. |
| Datos de pago | Visibles en la web, editables desde el panel. |

## 3. Stack

Todo en capa gratuita permanente, sin tarjeta de crédito.

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase: PostgreSQL, Auth, Storage, Realtime
- Vercel: hosting y dominio `.vercel.app`
- Resend: correo transaccional (3.000/mes, 100/día)

Resend en plan gratuito envía desde `onboarding@resend.dev` y **solo a la
dirección con la que se registró la cuenta**. Por eso la cuenta de Resend debe
crearse con anayabeauty54@gmail.com.

## 4. Modelo de datos

### categories
`id, nombre, slug, orden, parent_id (autoreferencia, permite subcategorías), activo`

### products
`id, referencia (UNIQUE), nombre, descripcion, category_id, imagen_principal,
galeria (text[]), stock (int, >= 0), activo, orden, created_at, updated_at`

La referencia es única y es el identificador que usa la administradora para
buscar productos en el panel.

### price_tiers
`id, product_id, min_cantidad (int), precio_unitario (int, COP sin decimales)`

Restricción: todo producto activo debe tener al menos un escalón con
`min_cantidad = 1`. Sin él, el motor de precios no puede cotizar 1 unidad.
Único por `(product_id, min_cantidad)`.

### access_codes
`id, code (char 4), estado (disponible | usado | anulado), creado_por,
created_at, vence_en, usado_en, order_id, nota`

Índice único parcial: `UNIQUE (code) WHERE estado = 'disponible'`. Esto permite
reutilizar un código viejo una vez quemado, sin colisionar con los activos.

### orders
`id, numero_pedido (texto, ej. AB-0043), code_id, cliente_nombre,
cliente_whatsapp, cliente_ciudad, total (int), estado
(nuevo | pagado | enviado | cancelado), notas_admin, created_at, updated_at`

`numero_pedido` se genera desde una secuencia de Postgres, con formato AB-0000.

### order_items
`id, order_id, product_id, referencia_snapshot, nombre_snapshot, cantidad,
precio_unitario_aplicado, subtotal`

Los campos snapshot congelan el estado del producto en el momento de la compra.
Cambiar el precio o el nombre de un producto no altera pedidos históricos.

### store_settings
Tabla clave-valor para configuración editable desde el panel: datos de pago
(Nequi/Daviplata/cuenta), WhatsApp de contacto, horas de vigencia de los códigos,
mensajes de la marca.

### code_attempts
`id, ip_hash, created_at`

Registro de intentos fallidos de canje, para el límite de intentos. Se guarda un
hash con sal de la IP, nunca la IP en claro.

## 5. Motor de precios escalonados

Entrada: `product_id`, `cantidad`.

1. Cargar los escalones del producto ordenados por `min_cantidad` descendente.
2. Tomar el primero cuyo `min_cantidad` sea menor o igual a la cantidad.
3. `subtotal = cantidad * precio_unitario` de ese escalón.

Ejemplo con escalones 1 a $10.000, 3 a $9.000 y 6 a $8.000:

| Cantidad | Escalón aplicado | Total |
|---|---|---|
| 1 | 1 und | $10.000 |
| 2 | 1 und | $20.000 |
| 3 | 3 unds | $27.000 |
| 4 | 3 unds | $36.000 |
| 5 | 3 unds | $45.000 |
| 6 | 6 unds | $48.000 |
| 7 | 6 unds | $56.000 |

**Sugerencia de upsell:** si existe un escalón superior, la interfaz calcula
cuántas unidades faltan para alcanzarlo y muestra el ahorro resultante. Esta
lógica vive en una función pura, compartida entre cliente y servidor.

El precio mostrado en el navegador es solo informativo. El total real siempre se
recalcula en el servidor al confirmar.

## 6. Confirmación del pedido: operación atómica

Función de Postgres `crear_pedido(codigo, nombre, whatsapp, ciudad, items)`,
declarada `SECURITY DEFINER` y ejecutada dentro de una única transacción:

1. `SELECT ... FOR UPDATE` sobre el código. Bloquea concurrencia.
2. Validar estado disponible y vigencia. Si falla, registrar intento y abortar
   con un error tipificado.
3. Para cada ítem: `SELECT ... FOR UPDATE` del producto, verificar que esté
   activo y que el stock alcance. Si falta stock, abortar indicando el producto
   y las unidades disponibles.
4. Recalcular el precio de cada línea con el motor de escalones, leyendo
   `price_tiers` desde la base de datos.
5. Descontar el stock.
6. Insertar el pedido y sus líneas con los snapshots.
7. Marcar el código como usado, con fecha y pedido asociado.
8. Devolver el pedido creado.

Cualquier fallo revierte todo: el código no se quema y el stock no se mueve.

El envío del correo ocurre **después** de que la transacción confirma, desde una
ruta de servidor de Next.js. Si el correo falla, el pedido ya está guardado y
visible en el panel; el fallo se registra pero no revierte la venta.

### Cancelación
Cambiar un pedido a cancelado ejecuta una función que devuelve el stock de cada
línea. La operación es idempotente: cancelar dos veces no duplica la devolución.

## 7. Seguridad

**Row Level Security en todas las tablas.**

- Lectura pública: `categories`, `products`, `price_tiers` (solo activos) y las
  claves públicas de `store_settings`.
- Sin acceso público: `access_codes`, `orders`, `order_items`, `code_attempts`.
  Los códigos jamás se exponen al navegador; si se pudieran leer, cualquiera
  obtendría uno gratis.
- Escritura: solo usuarios autenticados del panel, más la función
  `crear_pedido` con `SECURITY DEFINER`.

**Límite de intentos.** Un código de 4 dígitos son 10.000 combinaciones. Se
permiten 5 intentos fallidos por hash de IP cada 10 minutos. Combinado con la
vigencia limitada de los códigos y con que solo existen los códigos generados por
la administradora, adivinar resulta inviable a esta escala.

**Vigencia.** Los códigos vencen a las 24 horas por defecto, configurable desde
el panel.

**Validación del carrito.** El servidor ignora precios, nombres y totales
enviados por el navegador. Solo acepta pares de producto y cantidad.

## 8. Pantallas públicas

| Ruta | Contenido |
|---|---|
| `/` | Catálogo: logo, banner, buscador por nombre o referencia, categorías y subcategorías, filtros de precio y orden, grilla de productos. |
| `/producto/[referencia]` | Galería, tabla de escalones, selector de cantidad, sugerencia de upsell, aviso de stock bajo, botón de agregar. |
| `/carrito` | Líneas del pedido, ahorro total acumulado, aviso del código faltante con enlace directo a WhatsApp. |
| `/confirmar` | Código (autorellenado si viene por link mágico), nombre, WhatsApp y ciudad. |
| `/c/[codigo]` | Link mágico: guarda el código y redirige al carrito o a la confirmación. |
| `/pedido/[numero]` | Confirmación: número de pedido destacado, resumen, datos de pago, mensaje de marca y botón de WhatsApp con el mensaje preescrito. |

El carrito persiste en `localStorage`, de modo que salir a WhatsApp y volver no
pierde nada. Diseño mobile-first: el tráfico proviene de TikTok en vivo.

## 9. Panel de administración

Ruta `/admin`, protegida con Supabase Auth (correo y contraseña, dos usuarios).

- **Pedidos en vivo**: lista que se actualiza por Realtime, sin recargar. Filtros
  por estado y buscador por nombre, número o WhatsApp. Cambio de estado y
  cancelación con devolución de stock.
- **Códigos**: botón de generar. Muestra el código, el link mágico y un mensaje
  listo para pegar en WhatsApp, con botón de copiar. Lista de códigos activos,
  usados y vencidos, con opción de anular.
- **Productos**: alta y edición con referencia, nombre, descripción, categoría,
  imagen principal, galería, stock y escalones de precio. Buscador por referencia
  o nombre. Importación masiva por CSV, indispensable con más de 150 productos.
- **Categorías**: gestión de categorías y subcategorías con orden.
- **Configuración**: datos de pago, WhatsApp, vigencia de códigos, mensajes.
- **Código QR**: genera y descarga el QR de la web en alta resolución.

## 10. Correo de notificación

Se envía a anayabeauty54@gmail.com al confirmarse cada pedido.

Asunto: `Pedido #AB-0043 — Laura Gómez — $74.000`

Cuerpo con la identidad de la marca: número de pedido, nombre, WhatsApp, ciudad,
código utilizado, fecha, tabla de productos con referencia, cantidad y subtotal,
total, y enlace al panel.

**Límite conocido:** 100 correos diarios en el plan gratuito. La fuente principal
de verdad es el panel en tiempo real; el correo es respaldo. Ningún pedido se
pierde si el correo falla o se agota la cuota.

## 11. Identidad visual

Colores tomados del logo de la marca:

| Rol | Valor |
|---|---|
| Fucsia Anaya | `#E5308A` |
| Lila Beauty | `#A97FD0` |
| Rosa nube (fondo) | `#FDF2F7` |
| Blanco pétalo | `#FFFFFF` |
| Carbón suave (texto) | `#3D2B36` |

Tipografías: `Playfair Display` para títulos, `Nunito` para el resto.

Lenguaje visual: esquinas muy redondeadas, sombras rosadas en lugar de grises,
destellos y corazones discretos, micro-animación del producto viajando al carrito
con rebote del contador. Mensajes cálidos en cada confirmación.

Accesibilidad: contraste mínimo AA sobre el fondo rosa, áreas táctiles de al
menos 44 px, y respeto a `prefers-reduced-motion`.

## 12. Configuración manual del propietario

1. Crear proyecto en Supabase y ejecutar el archivo SQL entregado, que crea
   tablas, políticas, funciones y datos iniciales.
2. Crear cuenta en Resend **con anayabeauty54@gmail.com** y obtener la API key.
3. Crear proyecto en Vercel, conectar el repositorio y definir las variables de
   entorno.
4. Crear los dos usuarios del panel en Supabase Auth.
5. Cargar los productos, manualmente o por CSV.

## 13. Estrategia de pruebas

- **Motor de precios**: pruebas unitarias sobre la función pura, cubriendo
  cantidades exactas, intermedias, por debajo del primer escalón y el cálculo de
  la sugerencia de upsell.
- **Confirmación de pedido**: pruebas de integración contra Supabase local.
  Incluyen código válido, código ya usado, código vencido, stock insuficiente,
  intento de manipular precios desde el cliente, y **dos confirmaciones
  simultáneas por el último producto disponible**.
- **Cancelación**: verificar la devolución de stock y su idempotencia.
- **Límite de intentos**: verificar el bloqueo tras cinco fallos.
- **Recorrido completo**: prueba end-to-end desde el catálogo hasta la pantalla
  de confirmación.

## 14. Fuera de alcance

Deliberadamente excluido de esta versión: pasarela de pago en línea, cuentas de
cliente, lista de deseos, reseñas, cupones de descuento, cálculo automático de
envío, integración con transportadoras, analítica avanzada e inventario por
variantes (tono o talla). Ninguno es necesario para operar los lives, y cada uno
añadiría superficie que hay que mantener.
