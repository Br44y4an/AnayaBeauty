# Rediseño del catálogo Anaya Beauty (v5) — diseño

Fecha: 10-nov-2026 · Estado: aprobado por el dueño («te apruebo desde ya el proceso», con despliegue a producción y respaldo).
Fuentes: el estudio `docs/estudio/2026-11-10-estudio-completo.md` y las 10 auditorías en
`C:\Users\Brayan\AppData\Local\Temp\claude\c4f901e614d65603\4f5f8714-b889-4714-9ae0-ed67ee592183\scratchpad\auditoria\*.json`
(ux_tienda, benchmark, visual_copy, codigo_tienda, nextjs, datos_backend, admin, critica, hueco_1 tonos, hueco_2 negocio).

## 1. Intención

Las clientas llegan desde un live o un enlace de WhatsApp, casi siempre en el celular, y muchas pasan de 40 años. Dicen que
elegir un producto y pedir es complicado. El flujo no es largo (unos 6 toques); lo que falla es la orientación y el ruido:
un banner que pide un código que ya no existe, 27 categorías en una fila, la foto de la tarjeta que abre un zoom en vez del
producto, tonos que se eligen a ciegas porque la foto que hace de leyenda se ve a 96 px y recortada, la misma oferta escrita
cuatro veces, emoji y rosa por todas partes. La v5 quiere que la tienda se sienta como la de una marca de belleza seria:
limpia, ordenada, rápida, y que elegir varios tonos y confirmar sea obvio.

## 2. Metas, no metas y antimetas

Metas
- Encontrar: cabecera fija con búsqueda y bolsa; 7 departamentos en vez de 26 categorías planas; búsqueda que entiende
  «usk621», «pestanas», «rimel», «brocha polvo».
- Decidir: toda la tarjeta abre el producto en una vista rápida con URL propia (ruta interceptada); al cerrar se vuelve al
  mismo punto de la lista. La foto se ve completa y ampliable porque es la leyenda de los tonos.
- Elegir varios tonos de una vez: lista de variantes con su propio −/cantidad/+, un solo botón «Agregar N · $X».
- Confirmar: bolsa agrupada por producto, deshacer al quitar, progreso al siguiente beneficio, formulario de 3 campos que
  se puede recordar, total honesto («Total productos» + texto de envío), aviso de privacidad.
- Pagar: la página del pedido abre con los datos de pago y un botón de WhatsApp con el mensaje completo; el pedido queda
  guardado en el celular («Mis pedidos»).
- Verse profesional: sistema visual sobrio (blanco, tinta casi negra, un solo acento fucsia), cero emoji, textos cortos.
- Código limpio: una sola lógica de compra, VistaCarrito partido, lecturas por GET/RSC con caché, utilidades sin duplicar,
  comentarios de 3 líneas máximo.
- Seguridad: que una cuenta nueva no sea administradora; Realtime de pedidos funcionando; nada de secretos en el repo.

No metas (esta iteración)
- Marcas tocables sobre la foto por tono, segundo eje modelo×color, foto por tono.
- Pagos en línea, subir el comprobante a la web, cuentas de clienta.
- «Agregar a mi pedido» con recálculo, bolsa abierta durante el live, crear pedidos desde el panel.
- Renombrar tonos o corregir hex en la base (es trabajo de la dueña con la hoja de contacto; ver §14).
- Activar Cache Components.

Antimetas (si pasa esto, fracasó aunque funcione)
- Que el primer producto no se vea en la primera pantalla del celular.
- Que «Atrás» saque a la clienta de la tienda o le borre lo cargado.
- Que la foto que sirve de leyenda se recorte o se vea pequeña al elegir el tono.
- Que agrupemos tonos por familia de color o pintemos círculos de color que mienten.
- Modales de venta cruzada, contadores de urgencia falsos, emoji, «princesa».
- Que el sitio viejo deje de funcionar con la base nueva (todo cambio de base es compatible hacia atrás).

## 3. Decisiones tomadas (y por qué)

Todas son decisiones mías con el mandato del dueño; las marco para que se puedan revisar.
1. **Sistema visual** del auditor visual (§5). Se rechaza la propuesta «lujo negro y dorado, Playfair + Inter» de la
   herramienta de diseño: borra el fucsia de la marca y es justo la plantilla que queremos evitar.
2. **Bolsa en la cabecera** (icono con contador) + **aviso al agregar** con «Ver bolsa». Se retira la píldora flotante
   «Ver mi pedido», que tapaba precios y botones.
3. **Vista rápida = la ficha** como modal interceptado (`@modal/(.)producto/[referencia]`). Se retira `HojaCompra`: el tono se
   elige dentro de la ficha (modal o página). Una sola implementación de compra.
4. **Selector multi-variante** en lista, en el orden de la foto, nunca agrupado por familia (hueco_1: agrupar desordena
   24 de 26 productos de 10+ tonos). Círculo de color solo si las muestras del producto son confiables (§7.5).
5. **Etiqueta de variante** por producto con herencia de la categoría y del departamento: Tono, Color, Diseño, Modelo,
   Aroma, Largo o Paleta. Por defecto: Rostro, Ojos y cejas, Labios → «Tono»; el resto → «Color».
6. **Agotado por tono** como bandera (`product_shades.agotado`), sin stock por tono. La dueña deja de borrar tonos para
   marcarlos agotados (borrar renumera la foto).
7. **Departamentos**: 7 madres (Rostro; Ojos y cejas; Labios; Brochas y herramientas; Cuidado personal; Cabello y peinado;
   Bolsos y accesorios). Los productos siguen en sus categorías hijas; filtrar por la madre incluye a las hijas.
8. **Los 10k de «abrir bolsa»**: la v4 eliminó el código a propósito; no se reintroduce ningún cobro previo. El banner sale
   de la tienda. Queda como pregunta para la dueña en el informe.
9. **Envío**: no hay tarifa en ninguna parte. Nuevo ajuste público `envio_info` editable en el panel, con el texto por
   defecto «El envío se coordina por WhatsApp después de confirmar tu pedido.» El total se rotula «Total productos».
10. **Legal mínimo**: página `/privacidad` (Ley 1581 y condiciones de compra de la Ley 1480 en lo que sabemos), aviso junto a
    «Confirmar» (conducta inequívoca) y registro de la versión aceptada en `orders`. La identidad legal (NIT, dirección) la
    completa la dueña.
11. **Caché pública** sin cookies + `unstable_cache` con etiquetas + ISR de la ficha; invalidación al confirmar pedidos y al
    guardar en el panel. No se activa Cache Components.
12. **Lecturas por GET** (`/api/catalogo`, `/api/buscar`, `/api/bolsa`); el único Server Action público es `confirmarPedido`.
13. **Seguridad**: tabla `administradores` + `es_admin()` en todas las políticas de escritura, en el proxy y en las
    acciones del panel. Realtime publica `orders`. La clave de diagnóstico sale de SETUP.md.
14. **Mensaje de éxito**: el título fijo es «¡Pedido confirmado!» (la única exclamación del recorrido). El ajuste
    `mensaje_exito` pasa a «Gracias por comprar en Anaya Beauty.» y se muestra como línea secundaria.
15. **Muestras de color en la tarjeta: no.** La tarjeta dice «6 tonos» o «4 colores» en texto.

## 4. Arquitectura de rutas

```
src/app/
  layout.tsx                         html/body, fuente Figtree, metadata, viewport; pinta {children}{modal}
  @modal/default.tsx                 null (obligatorio en Next 16)
  @modal/(.)producto/[referencia]/page.tsx    vista rápida (ISR), sin notFound(): muestra «ya no está disponible»
  @modal/(.)producto/[referencia]/loading.tsx esqueleto con forma de hoja
  (tienda)/layout.tsx                Encabezado + children + Pie + Avisos + SincronizarBolsa
  (tienda)/page.tsx, loading.tsx     catálogo (dinámico por searchParams, datos desde caché)
  (tienda)/producto/[referencia]/page.tsx, loading.tsx, not-found.tsx   ficha completa (ISR revalidate 300, generateStaticParams [])
  (tienda)/carrito/page.tsx, loading.tsx, actions.ts   bolsa y confirmarPedido
  (tienda)/pedido/[id]/page.tsx, loading.tsx            pedido confirmado (dinámico)
  (tienda)/mis-pedidos/page.tsx      pedidos guardados en este celular (cliente)
  (tienda)/privacidad/page.tsx       privacidad y condiciones
  api/catalogo/route.ts              GET «Ver más»
  api/buscar/route.ts                GET sugerencias
  api/bolsa/route.ts                 GET datos frescos de la bolsa (no-store)
  api/diagnostico/route.ts           endurecido (§10)
  admin/...                          panel (§11)
  error.tsx, global-error.tsx, not-found.tsx, opengraph-image.png
```
- Si la interceptación desde la raíz no alcanza la ficha dentro de `(tienda)`, el slot `@modal` se mueve a
  `(tienda)/@modal` y `(tienda)/layout.tsx` recibe `{children, modal}`. Verificarlo con `next build` y navegación real.
- Cerrar el modal: `router.back()` protegido contra doble toque (ref + comprobar `location.pathname` empieza por
  `/producto/`). Guard: `ModalProducto` devuelve null si `usePathname()` no empieza por `/producto/` (no usar el catch-all
  de la doc: vuelve 200 cualquier URL inexistente). Dentro del modal los saltos entre productos usan `<Link replace>`.
- `Buscador` y el orden no leen `useSearchParams` mientras el modal está abierto; el estado de filtros llega por props.
- Los redirects de `next.config.ts` (`/confirmar`, `/c/:codigo` → `/carrito`) se conservan.
- Enlaces desde el panel a la tienda usan `<a href target="_blank">` para no abrir el modal sobre el panel.

## 5. Sistema visual

Tokens en `src/app/globals.css` (`@theme`), con nombres nuevos:

| Token | Valor | Uso |
|---|---|---|
| `--color-fondo` | #ffffff | página, hoja, cabecera; theme-color |
| `--color-superficie` | #f7f3f5 | teselas de foto, resumen, fila activa, esqueletos |
| `--color-tinta` | #261c22 | texto, precios, iconos, botón secundario |
| `--color-tinta-suave` | #6d5765 | c/u, ayudas, «Ref.», metadatos (nunca con opacidad) |
| `--color-linea` | #ebe4e8 | separadores decorativos |
| `--color-borde` | #8e7d88 | borde de campos, stepper, botón de contorno (≥3:1) |
| `--color-acento` | #d11a72 | relleno de la acción principal, contador de la bolsa, anillo de foco |
| `--color-acento-hondo` | #a8145a | hover/presionado del primario |
| `--color-firma` | #8956b8 | etiqueta de categoría en mayúsculas (12 px) y nada más |
| `--color-ahorro` / `--color-ahorro-fondo` | #0f7a52 / #e4f6ee | ahorro, «en tu bolsa», confirmaciones |
| `--color-alerta` / `--color-alerta-fondo` | #96591b / #fdf1e0 | «Quedan 3», cambios en la bolsa |
| `--color-error` / `--color-error-fondo` | #b42318 / #fef3f2 | errores de campo y de servidor |
| `--color-inactivo` | #e9e3e6 | fondo de botón no disponible (texto tinta-suave) |

- Alias temporales para el panel (`fucsia`, `fucsia-texto`, `fucsia-vivo`→acento; `fucsia-hondo`→acento-hondo;
  `fucsia-suave`→#f3c9dc; `lila`, `lila-texto`, `lila-vivo`→firma; `lila-suave`→linea; `rosa-nube`→superficie;
  `petalo`→fondo; `carbon`→tinta; `carbon-suave`→tinta-suave; `exito`→ahorro; `exito-fondo`→ahorro-fondo). El equipo del
  panel migra a los nombres nuevos y la integración borra los alias. `contraste.test.ts` se reescribe con los nombres
  nuevos y añade: borde ≥3:1 sobre fondo y superficie, blanco sobre acento-hondo, error sobre error-fondo, tinta-suave sobre
  inactivo, firma sobre fondo y superficie.
- Tipografía: una sola familia, **Figtree** (`next/font/google`, variable, `--fuente-figtree`), `font-variant-numeric:
  tabular-nums` en precios, cantidades y números de pedido. Escala (px tamaño/interlínea · peso): 12/16·600 mayúsculas
  +0,08em (categoría, «Ref.»); 13/18·400 (c/u, ayudas); 14/20·400–500; 15/20·500 (nombre en grilla, pestañas); 16/24·400
  texto y campos (nunca menos en inputs), 600 botones; 17/22·700 precio grilla; 20/26·600 títulos de sección y de hoja;
  24/30·600 h1, 700 precio de ficha y total; 28/34·600 nombre en ficha (32/38 desde 1024); 32/36·700 número de pedido.
  Se eliminan Playfair, Nunito y la regla global de serif en h1–h3.
- Radios: 4 (miniaturas, etiqueta Agotado), 8 (botones, campos, stepper, avisos, tablas), 16 (esquinas superiores de la
  hoja y diálogos), círculo (muestras, contador, cerrar). Teselas de la grilla sin radio.
- Elevación: plano. Separar con espacio y líneas de 1 px. Dos sombras neutras: `--shadow-flotante` (avisos)
  `0 6px 20px rgb(38 28 34 / .18)` y `--shadow-hoja` `0 -8px 32px rgb(38 28 34 / .18)`; velo `rgb(38 28 34 / .48)`.
- Imágenes: tesela 1:1 color superficie, foto `object-contain` al 88 % con `mix-blend-multiply`; sin recorte, sin zoom al
  pasar, sin insignias encima salvo «Agotado». En la ficha la foto va completa a todo el ancho (no cuadrada a la fuerza:
  `object-contain` dentro de una caja 4:3 o 1:1 según la foto) y se amplía con un toque (visor con pellizco y doble toque,
  hasta 2×; el 85 % de las fotos mide ~500×380).
- Iconos: un set de línea propio en `Iconos.tsx` (24×24, trazo 1,75, puntas redondas, `currentColor`): buscar, bolsa,
  cerrar, atrás, chevron, más, menos, eliminar, check, copiar, compartir, alerta, info, WhatsApp (glifo relleno, el único).
  Fuera la lupa sobre las fotos, el corazón y los caracteres «×» y «✓».
- Movimiento: 120–220 ms; entrada `cubic-bezier(.2,0,0,1)`, salida `cubic-bezier(.4,0,1,1)`. Hoja sube 220 ms, sale
  160 ms. Sin rebotes ni escalas >1,02. Hover solo bajo `@media (hover:hover)`. Se mantiene `prefers-reduced-motion`.
- Marca: componente `Marca` con el logotipo «Anaya» + «BEAUTY» recortado de `logo.jpeg` (sin círculo, corona, mariposa
  ni ramas), fondo transparente, `public/marca/anaya-beauty.png` (alto útil ≥ 2× el de pantalla). 36 px de alto en
  celular, 40 en escritorio. Si el recorte no queda limpio, alternativa: «Anaya» en una script de Google Fonts cercana +
  «BEAUTY» en Figtree espaciado, sin inventar otro logo. `src/app/opengraph-image.png` 1200×630 con el logo completo
  sobre blanco.
- Accesibilidad: base 16 px; objetivos ≥44 px; AA en todo texto; foco visible (anillo acento 2 px con separación);
  `maximumScale 5`; etiquetas visibles; errores junto al campo con `aria-describedby`; el contraste se prueba.

## 6. Pantallas de la tienda

### 6.1 Cabecera (todas las páginas de la tienda)
Fija, 56 px, fondo blanco, borde inferior de 1 px. Celular: [Marca] … [buscar] [WhatsApp] [bolsa con contador].
Escritorio (≥1024): [Marca] [campo de búsqueda 420 px] … [WhatsApp «Escríbenos»] [bolsa «Bolsa (3)»].
- La lupa abre `BusquedaRapida` (§6.4). En escritorio el campo de la cabecera la abre como panel desplegable.
- El contador de la bolsa usa `useTotalUnidades`; cambia sin rebote (fundido 160 ms). Lleva `aria-label «Bolsa, 3
  unidades»`.
- `scroll-padding-top` = alto de la cabecera + pestañas.

### 6.2 Catálogo (`/`)
Orden vertical en celular (390×844), con la grilla empezando antes de ~360 px:
1. Franja de beneficios (no fija), 1 línea en superficie, 13–14 px, generada de las reglas: «Más unidades, mejor precio ·
   5 % menos desde $50.000 · Por mayor desde $200.000». Se oculta si no hay reglas.
2. Campo de búsqueda grande «Busca por nombre o referencia» (abre `BusquedaRapida`).
3. Pestañas de departamentos, fijas bajo la cabecera (44 px): «Todo», Rostro, Ojos y cejas, … desplazables en horizontal,
   texto con subrayado de 2 px en la activa, la activa se centra al cargar. Con categorías planas (sin madres) muestran las
   raíces.
4. Si hay departamento activo: fila de subcategorías (chips de texto con borde, no fija): «Todo en Labios», «Lip gloss»…
5. Barra de resultados: «Labios · 43 productos» a la izquierda; a la derecha «Ordenar: Recomendados ▾» (select nativo
   estilizado, montado una sola vez). Opciones: Recomendados, Precio: menor a mayor, Precio: mayor a menor, Más nuevos.
6. Riel «Destacados» (solo sin filtros ni búsqueda y si hay productos con `destacado`), tarjetas compactas en scroll
   horizontal, máximo 12.
7. Grilla: 2 columnas (gap 12/24) en celular, 3 desde 768, 4 desde 1024; contenido máx. 1200 px.
8. «Ver más productos» + «Viendo 48 de 372». Carga con `GET /api/catalogo` y actualiza la URL con
   `window.history.replaceState` (`?pagina=N`, máx. 10). El servidor pinta las páginas 1..N si llega con `pagina`.
9. Estado vacío: «No encontramos productos para "x"». Sugerencias: departamentos y «Escríbenos por WhatsApp».
Navegar entre departamentos usa `<Link scroll={false}>` y lleva la vista al inicio de la barra de resultados.

### 6.3 Tarjeta de producto
- Toda la tarjeta (foto y nombre) es un `<Link>` a `/producto/{encodeURIComponent(ref)}` (abre el modal). `prefetch` por
  defecto; `useLinkStatus` muestra un indicador sutil si el toque llega antes del prefetch.
- Contenido: tesela 1:1 · categoría (firma, 12 px mayúsculas) · nombre (15 px, 2 líneas) · «Ref. GLS735» (12 px tinta
  suave) · precio de 1 unidad «$8.000 c/u» (17 px 700) · «3 o más: $7.500 c/u» (13 px tinta suave; si hay un solo
  escalón no se muestra) · acción · estado.
- Acción (botón de contorno, 44 px, ancho completo, no fucsia):
  - Con variantes: «Elegir tono · 6» / «Elegir color · 4» / «Elegir diseño · 30» → abre la ficha (es un Link).
  - Sin variantes y con stock: «Agregar». Al tocar agrega 1, vibra (si se puede) y muestra el aviso. Luego se convierte
    en stepper compacto (− 2 +); bajar a 0 quita la línea (con «Deshacer» en el aviso).
  - Agotado: etiqueta «Agotado» sobre la foto (esquina inferior izquierda) y sin botón.
  - Sin precio: «Precio por confirmar» y sin botón.
- Estado bajo la acción: «✓ 2 en tu bolsa» (icono check, color ahorro) si hay unidades; «Quedan 3» (alerta) si stock ≤ 5.
- Sin insignia «Combo», sin lupa, sin upsell, sin «$X en total». Tarjeta presentacional con `memo`; las suscripciones al
  carrito se limitan al producto.

### 6.4 Búsqueda rápida
Diálogo a pantalla completa en celular; panel bajo el campo en escritorio. Campo con foco automático, botón borrar,
`<form role="search">` (Enter busca y cierra el teclado).
- Mientras escribe (debounce 200 ms, mínimo 2 caracteres): hasta 8 sugerencias de `GET /api/buscar?q=` con miniatura,
  nombre, «Ref.» y precio; la referencia exacta primero. Tocar una abre la ficha (modal).
- «Ver los 23 resultados» → `/?q=…` y cierra.
- Enter: si hay coincidencia exacta de referencia (sin separadores) abre ese producto; si no, `/?q=…`.
- Sin texto: accesos a departamentos. Sin resultados: «No encontramos "x". Prueba con la referencia o escríbenos por
  WhatsApp» + botón WhatsApp.
- Escape y «Atrás» cierran el diálogo (empuja una entrada de historial con `?buscar=1` o usa el patrón de hoja con
  historial del §6.9).

### 6.5 Ficha de producto (modal y página)
Un componente servidor `FichaProducto` (datos) + cliente `PanelCompra` (interacción), con variante `modal` | `pagina`.
- Modal en celular: hoja a pantalla completa que sube desde abajo, barra superior con [cerrar] y [compartir]
  (`navigator.share` o copiar enlace), contenido con scroll, pie fijo con el botón principal. En escritorio: diálogo
  centrado máx. 1040 px, dos columnas (foto 7/12 izquierda fija, compra 5/12 con scroll).
- Página completa: misma composición; en escritorio dos columnas con la foto fija; en celular columna única con pie fijo.
  Enlace «Volver al catálogo» que usa `router.back()` si se llegó desde la tienda y `/` si no.
- Orden del contenido: foto completa (toque = ampliar) · categoría · nombre (h1 en la página, h2 en el modal) · Ref. ·
  bloque de precio por cantidad · selector de variantes o cantidad · «En tu bolsa» · descripción (si no repite el nombre)
  · riel «Más de {categoría}» (misma categoría o departamento, con stock, sin el actual, máx. 8).
- Bloque de precio por cantidad: filas o chips «1 u $8.000 · 3+ $7.500 · 6+ $6.500» con el escalón vigente resaltado
  según las unidades totales (bolsa + selección). Si el producto tiene 2+ variantes: «Puedes mezclar tonos: cuentan
  juntos para el precio.» Un solo lugar para la oferta.
- Producto no disponible en el modal: mensaje «Este producto ya no está disponible» + Cerrar (no `notFound()`).

### 6.6 Selector de variantes (`SelectorVariantes`)
- Título «Elige el tono» / «Elige el color» / «Elige el diseño»… según la etiqueta. Debajo, «La numeración corresponde a
  la foto. Tócala para ampliarla.» solo si los nombres son del tipo «Tono N».
- Lista en el orden guardado (`orden`, que es el de la foto), una fila por variante (≥ 56 px): [círculo 28 px si las
  muestras son confiables] [nombre] [«En tu bolsa: 2» si aplica] [stepper − n +]. Una columna en celular, dos en el
  diálogo de escritorio. Nunca agrupar por familia de color.
- Variante agotada: fila atenuada (texto tinta-suave), etiqueta «Agotado», sin stepper.
- Más de 12 variantes: campo «Buscar entre 36 tonos» que filtra por nombre conservando el orden.
- Un solo tono: la fila con su stepper (sin selección automática silenciosa).
- Stepper: botones de 44 px, cantidad en `<output>`, mínimo 0 en el selector, máximo según stock disponible del producto
  (stock − unidades en bolsa − unidades ya elegidas en otras filas).
- Sin variantes: un solo stepper «Cantidad» empezando en 1.
- Pie fijo: botón primario «Agregar 3 · $22.500» (precio = unitario del escalón para bolsa+selección × unidades nuevas).
  Sin selección: el botón dice «Elige un tono» y al tocarlo enfoca la lista con el mensaje «Elige al menos un tono».
  Nunca deshabilitado sin explicación.
- Al agregar: llama `agregar` por variante, vibra 15 ms, muestra el aviso «Agregado a tu bolsa · 3 × Brillo labial Oil
  Glazed · Ver bolsa», limpia la selección. En el modal además lo cierra (`router.back()`); en la página se queda.

### 6.7 Aviso (toast)
Pila abajo (encima del área segura), una a la vez, `role="status"`, 5 s o hasta el siguiente aviso; con miniatura,
título, detalle y una acción («Ver bolsa» o «Deshacer»). Sombra flotante. No tapa el pie fijo de la ficha: se apoya encima.

### 6.8 Bolsa (`/carrito`)
- Datos frescos de `GET /api/bolsa?ids=` (sin caché) solo cuando el carrito ya se hidrató (nada de llamada vacía) y con
  `reintentar()` real.
- Título «Tu bolsa» + «N productos». Si en el celular hay un pedido de las últimas 12 horas: aviso «Ya hiciste el pedido
  AB-0098 hoy. Este se enviará como adicional para empacarlo junto.» (el número viaja en `adicional`).
- Líneas agrupadas por producto: miniatura 64 px, nombre (enlace a la ficha), Ref., precio unitario aplicado
  («$7.500 c/u · precio de 3 o más»). Debajo, una fila por variante: [círculo si confiable] nombre, stepper (mínimo 1),
  papelera. Subtotal del producto a la derecha.
- Quitar (papelera o − en 1) quita la línea y muestra «Quitaste Tono 3 · Deshacer».
- Cambios por stock (reconciliación): avisos de alerta en la línea («Solo quedan 2: ajustamos la cantidad», «Este tono
  se agotó», «Este producto ya no está disponible»). Las variantes se reconcilian por id y, si no existe, por nombre.
- Progreso al siguiente beneficio: barra + «Te faltan $12.000 para el 5 % de descuento» o «Tienes 5 % de descuento» /
  «Precio por mayor aplicado».
- Resumen: Subtotal, Descuento (5 %), **Total productos**, y «Envío: {envio_info}».
- «Tus datos»: Nombre, WhatsApp (ayuda «Te escribimos a este número para el pago y el envío»; acepta espacios y +57),
  Ciudad, «Agregar una nota (opcional)» desplegable. Casilla «Recordar mis datos en este celular» (desmarcada por
  defecto; si estaba marcada, rellena). Ejemplos como ayuda, no como placeholder.
- Aviso legal bajo el formulario: «Al confirmar aceptas que usemos tus datos solo para gestionar tu pedido. Política de
  privacidad.» y «Aquí no pagas nada todavía: después de confirmar te mostramos cómo pagar.»
- Barra fija inferior: total + botón. Con campos obligatorios vacíos dice «Completar mis datos» y lleva y enfoca el primer
  campo vacío; completos: «Confirmar pedido · $45.000». Al enviar: pantalla «Confirmando tu pedido…».
- Errores del servidor junto al campo correspondiente o arriba del botón, con enlace a WhatsApp si persisten.
- Bolsa vacía: «Tu bolsa está vacía» + «Ver el catálogo» (enlace con estilo de botón) + pedidos recientes del celular.

### 6.9 Pedido confirmado (`/pedido/[id]`)
- Cabecera: icono check, «¡Pedido confirmado!», número grande tabular («Pedido AB-0098»), «Guarda este número para
  cualquier consulta.», `mensaje_exito` como línea secundaria si existe.
- Tarjeta «Cómo pagar» arriba: «Transfiere $45.000 por {método}», número con «Copiar», titular, «Copiar valor»,
  «Envío: {envio_info}». Botón primario «Ya pagué: enviar comprobante» → WhatsApp del negocio con «Hola, soy {nombre}. Ya
  pagué mi pedido AB-0098 por $45.000. Te envío el comprobante. {enlace}».
- «Qué sigue»: 3 pasos cortos (transferir, enviar el comprobante, te avisamos al despachar).
- Resumen del pedido (líneas, descuento, total productos).
- Al montar, se guarda en el celular (`anaya-pedidos`: id, número, total, fecha; máx. 20).
- «Volver al catálogo».

### 6.10 Otras
- `/mis-pedidos`: «Tus pedidos en este celular», lista con número, fecha, total y «Ver». Vacío: explica que se guardan
  al confirmar en este celular.
- `/privacidad`: responsable (Anaya Beauty, contacto por el WhatsApp del negocio), datos que se piden, finalidad
  (gestionar el pedido, coordinar pago y envío), derechos (conocer, actualizar, rectificar, suprimir, revocar) y cómo
  ejercerlos, vigencia; condiciones de compra: pago por transferencia después de confirmar, envío coordinado por WhatsApp,
  cambios y retracto (5 días hábiles según la Ley 1480, por WhatsApp), enlace a sic.gov.co. Versión «2026-11-10».
- Pie: Marca pequeña, «Mis pedidos», «Privacidad y condiciones», «WhatsApp», «Superintendencia de Industria y Comercio».
- `error.tsx`: «Algo no cargó bien» + «Volver a intentar» (`retry()`) + «Recargar la página» + WhatsApp. `global-error`
  con la misma paleta (colores de `lib/marca.ts`). `not-found` genérico «No encontramos esta página»; el de producto dice
  «Este producto ya no está disponible» + «Ver el catálogo».

## 7. Lógica de compra y datos en el cliente

### 7.1 Tipos (`src/lib/types.ts`)
```ts
export type EtiquetaVariante = "Tono" | "Color" | "Diseño" | "Modelo" | "Aroma" | "Largo" | "Paleta";
export type Categoria = { id: string; nombre: string; slug: string; orden: number; categoriaPadreId: string | null;
  etiquetaVariante: EtiquetaVariante | null };
export type Variante = { id: string; nombre: string; colorHex: string; orden: number; agotado: boolean };
export type Producto = { id: string; referencia: string; nombre: string; descripcion: string | null;
  categoriaId: string | null; categoriaNombre: string | null; categoriaSlug: string | null;
  imagenPrincipal: string | null; galeria: string[]; stock: number; activo: boolean; destacado: boolean;
  escalones: Escalon[]; etiquetaVariante: EtiquetaVariante; numVariantes: number;
  variantes: Variante[] | null /* null = no cargadas (grilla) */ };
```
`LineaCarrito` conserva sus campos persistidos (`productoId`, `tonoId`, `tonoNombre`, `cantidad`) para no migrar el
`localStorage` (versión 3). `Pedido` pierde `codigoUsado`.

### 7.2 Carrito (`src/lib/cart.ts`)
Hooks renombrados a la convención de React: `useCarrito`, `useLineasDeProducto`, `useUnidadesDeProducto`,
`useTotalUnidades`. Acciones: `agregar`, `establecer`, `quitar`, `restaurar(linea, indice)` (deshacer), `vaciar`,
`prepararEnvio`. Sincronización entre pestañas: `<SincronizarBolsa/>` escucha `storage` con la clave `anaya-carrito` y
llama `useCarrito.persist.rehydrate()`.

### 7.3 Compra (`src/lib/compra.ts`, puro y probado)
```ts
export type BloqueoCompra = "sin-precio" | "agotado" | "sin-seleccion" | "supera-stock";
export type ResumenCompra = { unidadesEnBolsa: number; unidadesNuevas: number; unidadesTotales: number;
  precioUnitario: number; subtotalNuevas: number; escalonActivo: Escalon | null;
  siguiente: { faltan: number; precioUnitario: number } | null; maxNuevas: number; bloqueo: BloqueoCompra | null };
export function resumenDeCompra(e: { escalones: Escalon[]; stock: number; unidadesEnBolsa: number;
  unidadesNuevas: number }): ResumenCompra;
```
Hook `useCompraProducto(producto)` en `src/hooks/`: selección por variante (`Record<string, number>`), `cambiar(id, n)`,
`resumen`, `agregar()` (agrega, vibra, avisa, limpia). Lo usa `PanelCompra`. `AgregarRapido` usa el carrito (`useCarrito`) y
`resumenDeCompra` directamente, sin el hook (decisión de la implementación: evitaba una dependencia entre tareas).

### 7.4 Avisos (`src/lib/avisos.ts`)
Store pequeño: `mostrarAviso({ titulo, detalle?, imagen?, accion?: { etiqueta, href? , alHacer? } })`, `cerrarAviso()`.
`<Avisos/>` en el layout de la tienda.

### 7.5 Variantes (`src/lib/variantes.ts`, puro y probado)
- `etiquetaDeProducto(producto.etiqueta ?? categoria.etiqueta ?? departamento.etiqueta ?? "Tono")` y
  `etiquetaPorDefecto(slugDepartamento)`: rostro/ojos-y-cejas/labios → Tono; resto → Color.
- `pluralVariante(etiqueta, n)`: «1 tono», «6 tonos», «4 colores», «3 diseños», «2 modelos», «5 aromas», «3 largos»,
  «4 paletas».
- `muestrasConfiables(variantes)`: false si algún hex falta o es inválido, si alguno es el valor por defecto del formulario
  (#E5308A), o si algún par tiene ΔE76 < 10 (Lab). Si es false, no se pinta ningún círculo de ese producto.
- `esNumeracionDeFoto(variantes)`: true si todos los nombres son «Tono N» o «Tono N …».
- `tonos.ts` conserva `hexAHsl`, `necesitaBorde`, `filtrarTonos`; se borran `agruparTonos` del uso de la UI y
  `textoSobre` (código muerto).

### 7.6 Datos del celular (`src/lib/celular.ts`)
`datosGuardados()/guardarDatos()/olvidarDatos()` (`anaya-datos`: nombre, whatsapp, ciudad) y
`pedidosGuardados()/guardarPedido()` (`anaya-pedidos`). Siempre con try/catch.

## 8. Datos y servidor

### 8.1 Cliente público y caché
- `src/lib/supabase/publico.ts` (server-only): cliente anon sin cookies (`persistSession:false`). Todas las lecturas
  públicas lo usan. `crearClienteServidor` (con cookies) queda para el panel.
- `src/lib/data/etiquetas.ts`: `ETIQUETA = { catalogo: "catalogo", precios: "precios", config: "config" }` y versión de
  forma `VERSION_DATOS = "v5"` en todas las keyParts.
- `unstable_cache` (revalidate 300) para categorías, configuración, reglas, páginas del catálogo sin búsqueda, destacados,
  ficha por referencia (envuelta además en React `cache()`), relacionados. Búsquedas y bolsa sin caché.
- Invalidación: `confirmarPedido` → `revalidateTag("catalogo", "max")` tras crear el pedido. Acciones del panel →
  `revalidateTag(tag, { expire: 0 })` del tag afectado (`catalogo`, `precios`, `config`). Se elimina `revalidatePath` con
  la referencia sin codificar.

### 8.2 Consultas (`src/lib/data/catalogo.ts` y `src/lib/categorias.ts`)
- `obtenerCategorias()`; puras: `arbolDeCategorias(categorias)`, `idsDeCategoria(slug, categorias)` (la categoría y sus
  hijas), `departamentoDe(categoriaId, categorias)`.
- `obtenerProductos({ categoriaSlug?, busqueda?, orden?, pagina?, hastaPagina? })` → `{ productos, total, pagina,
  porPagina }`. Filtra con `.in("category_id", ids)`. Orden por precio usa `precio_base` (el precio que se muestra), con
  `id` de desempate. Búsqueda vía RPC `buscar_productos` (§8.4). `POR_PAGINA = 24`; `pagina` ≤ 10; búsqueda ≤ 80 chars.
- `obtenerDestacados(limite)`, `obtenerProductoPorReferencia(ref)` (decodifica una sola vez con try/catch),
  `obtenerRelacionados(producto)`, `obtenerSugerencias(q)`, `obtenerConfiguracionPublica()` tipada:
  `{ mensajeExito: string | null; umbralPorMayor: number; whatsappNegocio: string; envioInfo: string;
  pago: { metodo: string | null; numero: string | null; titular: string | null } }`, `obtenerConfiguracionDePrecios()`.
- Errores: nunca devolver vacío en silencio; lanzar y dejar que `error.tsx` ofrezca reintentar (registrar con
  `console.error`).

### 8.3 Rutas GET
- `GET /api/catalogo?categoria&orden&q&pagina` → `{ productos, total, pagina, porPagina }`;
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- `GET /api/buscar?q=` → `{ total, productos: { referencia, nombre, imagenPrincipal, precioBase, numVariantes,
  etiquetaVariante }[] }` (máx. 8, referencia exacta primero); mismo Cache-Control.
- `GET /api/bolsa?ids=a,b` (máx. 60 UUID válidos) → `{ productos: { id, referencia, nombre, imagenPrincipal, stock,
  activo, escalones, etiquetaVariante, variantes }[], reglas, umbralPorMayor }`; `Cache-Control: no-store`.

### 8.4 Búsqueda
- TS (`src/lib/data/busqueda.ts`): `normalizarTexto` (NFD sin marcas, minúsculas), `gruposDeBusqueda(q)`: palabras sin
  vacías (de, del, la, las, el, los, y, en, con, para, por, un, una), singular simple (ces→z, es→ "" si >6, s→"" si >4),
  máx. 5 grupos; cada grupo con sinónimos unidos por `|`: rimel|rímel|mascara|pestanina; blush|rubor; gloss|brillo;
  neceser|cosmetiquera; labial|lipstick; delineador|delineadora; corrector|concealer; iluminador|highlighter.
  También el texto completo sin separadores como grupo alterno para referencias («usk 621» → «usk621»).
- SQL: `normalizar(text)` inmutable (translate de tildes + lower) y
  `buscar_productos(p_grupos text[], p_categorias uuid[] default null) returns setof products` security invoker, stable:
  un producto activo coincide si para cada grupo alguna alternativa aparece en
  `normalizar(nombre ‖ referencia ‖ descripcion ‖ categoría ‖ departamento ‖ nombres de variantes)` o en la referencia
  compacta `regexp_replace(normalizar(referencia), '[^a-z0-9]', '', 'g')`. Se consulta con
  `.rpc(..., { count: "exact" })` con el select de la grilla más las columnas de orden (PostgREST solo deja ordenar una RPC por columnas que estén en su select) para conservar embebidos, orden y rango.

## 9. Base de datos

### 9.1 `supabase/migracion-v5.sql` (esquema, compatible con la web vieja; se aplica primero)
1. `normalizar(text)` y `buscar_productos(text[], uuid[])`; `grant execute` a anon y authenticated.
2. `categories`: `etiqueta_variante text null` con check de valores; check `categoria_padre_id is distinct from id`;
   trigger `validar_dos_niveles` (máximo dos niveles).
3. `products`: `destacado boolean not null default false`, `etiqueta_variante text null` (mismo check).
4. `product_shades`: `agotado boolean not null default false`.
5. `orders`: `politica_version text null`, `politica_aceptada_en timestamptz null`.
6. `store_settings`: insertar `envio_info` (público) con el texto por defecto si no existe.
7. Seguridad: tabla `administradores(user_id uuid pk references auth.users on delete cascade)` con RLS y sin políticas;
   insertar las 2 cuentas actuales; función `es_admin()` security definer stable (revocada a public/anon, concedida a
   authenticated); reemplazar todas las políticas `*_admin` (categories, products, price_tiers, product_shades,
   discount_rules, store_settings, orders, order_items, access_codes) por `using ((select public.es_admin())) with check
   ((select public.es_admin()))`; políticas de `storage.objects` del bucket `productos` (insert/update/delete) igual.
   Revocar `execute` de `rls_auto_enable()` a anon y authenticated.
8. `cancelar_pedido`: devolver el stock sumando por producto (`group by product_id`); solo si no estaba cancelado.
9. `cambiar_estado_pedido(p_order_id uuid, p_estado text)` security definer, solo service_role: transiciones válidas
   nuevo→pagado, nuevo→enviado, pagado→enviado, pagado→nuevo y enviado→pagado (correcciones), nuevo|pagado→cancelado
   (delega en `cancelar_pedido`); cancelado es final. Lanza `TRANSICION_INVALIDA`.
10. Realtime: `alter publication supabase_realtime add table public.orders` si no está.
11. `mensaje_exito` → «Gracias por comprar en Anaya Beauty.» solo si hoy es el valor viejo con «princesa».
Acompañan `supabase/tests-v5.sql` (pruebas que terminan en `rollback`) y `supabase/revertir-v5.sql`.

### 9.2 `supabase/migracion-v5-departamentos.sql` (datos; se aplica después de publicar la web nueva)
Crea las 7 madres si no existen (slug, orden, etiqueta) y asigna las hijas por slug:
- Rostro (`rostro`, 10, Tono): polvos-y-bases, contornos-y-correctores, rubores, iluminadores.
- Ojos y cejas (`ojos-y-cejas`, 20, Tono): sombras, pestanina-y-delineadores, pestanas-postizas, cejas.
- Labios (`labios`, 30, Tono): labial-en-barra, labiales-liquidos, lip-gloss.
- Brochas y herramientas (`brochas-y-herramientas`, 40, Color): brochas-y-pinceles, blenders-y-aplicadores,
  encrespadores, depiladores-y-perfiladores, tijeras.
- Cuidado personal (`cuidado-personal`, 50, Color): skin-care, manicure-y-pedicure.
- Cabello y peinado (`cabello-y-peinado`, 60, Color): cabello, cepillos.
- Bolsos y accesorios (`bolsos-y-accesorios`, 70, Color): bolsos-y-morrales, neceseres, cosmetiqueras, espejos,
  gemas-facial-y-corporal, otros-accesorios.
Las inactivas (polvos, bases, cuidado-facial, unas-postizas, cortaunas, cortacuticula(s), gorros) no se tocan.
`revertir-v5.sql` deja `categoria_padre_id = null` en las hijas y borra las 7 madres.

### 9.3 Validaciones nuevas en `confirmarPedido` (sin cambiar `crear_pedido`)
Largo de campos (nombre ≤ 80, ciudad ≤ 60, whatsapp 7–15 dígitos, nota ≤ 300), máx. 40 líneas, 1–50 por línea y 150
unidades en total (si no, «Para pedidos tan grandes escríbenos por WhatsApp»); variantes: si el producto tiene variantes,
la línea debe traer una que exista y no esté agotada (código `TONO_NO_DISPONIBLE`, marca la bolsa). Tras crear el pedido:
`update orders set politica_version, politica_aceptada_en`, `revalidateTag("catalogo","max")`, y la consulta de líneas +
correo pasan a `after()`. `adicional` (número AB-xxxx válido) antepone «[Adicional a AB-xxxx] » a la nota.

## 10. Seguridad y operación
- `proxy.ts` y `exigirSesion()` → `exigirAdmin()` (usuario + `rpc("es_admin")`), cacheado con React `cache()`; todas las
  acciones y lecturas del panel lo llaman primero.
- `/api/diagnostico`: compara la clave con `timingSafeEqual`; no envía correo salvo con `?correo=1`; responde 404 sin
  clave. SETUP.md deja un marcador en vez de la clave.
- `scripts/cargar-catalogo-engol.mjs`: solo inserta referencias nuevas (`ignoreDuplicates: true`, `upsert: false` en fotos)
  y la documentación deja de decir que es seguro reejecutarlo.
- `next.config.ts`: `remotePatterns` con el host exacto del proyecto y la ruta del bucket, `formats: ["image/avif",
  "image/webp"]`, `minimumCacheTTL: 604800`, `serverActions.bodySizeLimit: "4mb"`.

## 11. Panel de administración (alcance v5)
1. Navegación: barra inferior en celular con 4 destinos (Pedidos con contador de nuevos, Productos, Recibos, Más) y lateral
   en escritorio; `aria-current`; `loading.tsx` y `error.tsx` propios del panel.
2. Pedidos: Realtime con indicador «En vivo / Reconectando», refresco al volver a la pestaña, el nuevo resaltado y contador
   en el título. Cada tarjeta muestra el siguiente paso como botón («Confirmar pago» si nuevo, «Marcar enviado» si pagado),
   «Cancelar» aparte (peligro, con confirmación), «Cobrar por WhatsApp» y «Avisar envío» con mensajes prellenados,
   «Recibo» (`/admin/recibos?pedido=id`). Estados vía `cambiar_estado_pedido`. KPIs del día en hora de Bogotá calculados
   aparte del filtro. Fechas con `timeZone: "America/Bogota"`. La nota «[Adicional a AB-xxxx]» se ve destacada.
3. Productos: filtros (Todos, Activos, Ocultos, Agotados, Sin foto, Destacados) y categoría; en cada fila
   «Ocultar/Mostrar» y «Destacar»; volver a la lista conserva `?q=`; aviso «Guardado». En el formulario: etiqueta de
   variante (con «Según la categoría»), destacado, editor de variantes con interruptor «Agotado», subir/bajar y guardado
   por id (actualiza, inserta y borra; nunca borra todo para reinsertar). Validar todo antes de escribir. Eliminar solo
   dentro de la ficha, con confirmación.
4. Fotos: compresión en el navegador (createImageBitmap + canvas, JPEG 0,85, lado máx. 1600 px) antes de enviar; error real
   en pantalla; borrar la foto anterior del bucket al reemplazar.
5. Categorías: lista editable con nombre (el slug no cambia al renombrar), madre (solo departamentos), orden (subir/bajar),
   etiqueta de variante, activar/ocultar y número de productos.
6. Ajustes: lista fija de claves válidas; WhatsApp validado (57 + 10 dígitos); nuevo «Información de envío» (`envio_info`);
   se quita «Horas que dura un código». La tienda usa `whatsapp_negocio` (con la constante como respaldo).
7. Importador CSV: para referencias existentes solo actualiza columnas con valor y nunca toca `activo`; muestra el resumen
   de cambios antes de confirmar.
8. QR con módulos oscuros (tinta) y `?o=qr`.
9. Restos del código de acceso fuera (join `access_codes`, `codigoUsado`, textos de Recibos). Todos los textos sin emoji.
10. Acciones con un único contrato `Resultado<T> = { ok: true; ... } | { ok: false; error: string }` y `Boton cargando`.
11. Invalida la caché pública (§8.1) después de cada escritura.
Fuera de alcance: dividir `ConstructorRecibo`, crear pedidos desde el panel, PWA.

## 12. Estructura y reglas de código
```
src/components/ui/        Boton (+ BotonEnlace / estilosBoton), Giro, Iconos, Campo, Stepper, Hoja, VisorImagen, Aviso(s),
                          Esqueleto, Insignia, Marca
src/components/tienda/    Encabezado, Pie, BarraBeneficios, BotonBolsa, SincronizarBolsa
src/components/catalogo/  PestanasDepartamentos, ChipsSubcategorias, BarraResultados, ListaProductos, TarjetaProducto,
                          AgregarRapido, RielDestacados, BusquedaRapida, EstadoVacio
src/components/producto/  FichaProducto, ModalProducto, PanelCompra, SelectorVariantes, PreciosPorCantidad, FotoProducto,
                          RielRelacionados, ProductoNoDisponible
src/components/bolsa/     VistaBolsa (orquesta, ~150 líneas), GrupoProducto, LineaVariante, AvisoCambios,
                          ProgresoBeneficio, ResumenBolsa, FormularioDatos, BarraConfirmar, PantallaConfirmando,
                          BolsaVacia, PedidosRecientes
src/components/pedido/    TarjetaPago, PasosPedido, ResumenPedido, CopiarDato
src/hooks/                useCompraProducto, useBolsa, useConfirmarPedido, useBloquearScroll, useHistorialHoja
src/lib/                  types, cart, compra, avisos, variantes, celular, categorias, ids (esUuid), dispositivo
                          (vibrar), rutas (rutaProducto, urlCatalogo), whatsapp (enlaceWhatsApp(numero, mensaje),
                          normalizarWhatsapp), formato (pesos, fechaCorta Bogotá), marca (paleta para correo/PDF/
                          global-error), pricing, discounts, tonos, color, carrito/reconciliar,
                          carrito/mensajes (mensajeAmable), data/*, supabase/*, email/*, pdf/*
```
Reglas: nombres en español salvo los hooks (`use*`); comentarios de 3 líneas máximo y solo para invariantes no evidentes
(la historia va al commit o a `Funcionalidades.md`); nada de `<a><button>`; nada de efectos para orquestar lo que puede
hacer un manejador; callbacks estables en diálogos (`useEffectEvent` o ref); ningún componente de más de ~250 líneas;
textos en el componente que los usa (sin archivo global de textos); sin `as unknown as` nuevos.

## 13. Pruebas y verificación
- Vitest con entorno `node` por defecto; `// @vitest-environment jsdom` solo en pruebas de componentes.
- Conservar sin cambios de comportamiento las pruebas de pricing, discounts, reconciliar, busqueda (ampliada), paginacion,
  csv, slug, imagen, storage, send-order, order-template (textos sin «Código usado»).
- Nuevas: compra (resumenDeCompra), variantes (etiqueta, plural, muestrasConfiables, esNumeracionDeFoto), categorias
  (árbol, ids), busqueda (grupos, sinónimos, referencia compacta), cart (renombre, restaurar, sincronización), celular,
  mensajes de error, validación de `confirmarPedido`, contraste con tokens nuevos, y componentes: TarjetaProducto,
  SelectorVariantes, PanelCompra, BusquedaRapida, VistaBolsa (reintento real, deshacer), Avisos.
- SQL: `tests-v5.sql` con `rollback`: buscar_productos («usk621», «pestanas», «brocha polvo»), dos niveles, es_admin,
  cancelar con dos tonos del mismo producto, transiciones.
- Cierre: `npx tsc --noEmit`, `npm test`, `npm run build` en verde; capturas con `cdp.mjs` en 390×844 y 1366×900 de
  inicio, departamento, búsqueda, modal con tonos, agregar, bolsa, pedido de prueba (AB-0009) y error; recorrido con
  teclado del modal y la bolsa. Nunca pulsar «Confirmar pedido» contra la base real.

## 14. Despliegue, respaldo y reversión
- Respaldo hecho: rama `respaldo/antes-rediseno` y etiqueta `respaldo-antes-rediseno-2026-11-10` en d66f76c (GitHub).
  Vercel conserva el despliegue anterior para «Instant Rollback».
- Orden: (1) `migracion-v5.sql` (compatible con la web vieja) + `tests-v5.sql`; (2) web nueva en la rama
  `rediseno-catalogo`, verificación local y de la vista previa de Vercel; (3) merge a `master` → producción; (4)
  `migracion-v5-departamentos.sql`; (5) verificación en producción.
- Reversión: promover el despliegue anterior en Vercel (o `git revert`/push de la rama de respaldo) y ejecutar
  `supabase/revertir-v5.sql` (departamentos). Las columnas, funciones y políticas nuevas son compatibles con la web vieja y
  se quedan.
- Cuando el dueño apruebe: borrar la rama y la etiqueta de respaldo.

## 15. Tareas que quedan para la dueña o el dueño
Desactivar «Allow new users to sign up» y activar la protección de contraseñas filtradas en Supabase Auth; rotar
`CLAVE_DIAGNOSTICO` en Vercel (la vieja quedó en el historial público); decidir si siguen los 10k de «abrir bolsa» y
qué son; poner el texto real de envío en Ajustes; completar la identidad legal (NIT, dirección) en `/privacidad`; limpieza
de tonos con la hoja de contacto (47 accesorios «Tono N» a su color, 200 hex no confiables, 33 fotos que no cuadran,
marcar agotados con el interruptor en vez de borrar); confirmar los pedidos de prueba (AB-0009/10/11/12/19); revisar el
pedido AB-0097 del 10-nov.

## 16. Cambios durante la implementación
Desvíos reales respecto de lo escrito arriba:
- **Búsqueda por relevancia.** En «Recomendados» con búsqueda, el orden se calcula en TS por nivel de coincidencia (nombre,
  referencia, categoría, departamento) y se traen hasta 240 resultados. El orden por precio o novedad sigue en la base.
- **Sin foto al final.** En cada página de «Recomendados», los productos sin foto van al final (uno de ellos abría el catálogo).
- **404 real.** Un producto inexistente respondía 200 con `noindex`, porque `notFound()` solo devuelve 404 fuera de todo
  `<Suspense>`. El catálogo se movió a `(tienda)/(catalogo)/` (con su `loading.tsx`) y la ficha no tiene `loading.tsx`. Cambia el
  árbol del §4: `(tienda)/page.tsx` y `(tienda)/loading.tsx` ahora viven en `(tienda)/(catalogo)/`.
- **Pedido guardado en el celular solo al llegar desde «Confirmar».** El §6.9 decía «al montar». Ahora la página guarda solo con
  `?nuevo=1` y luego quita el parámetro: si no, el celular de quien abre el enlace del comprobante (la dueña) acumularía los
  pedidos de las clientas. La página del pedido además respeta el estado (pagado, enviado, cancelado).
- **Recibos personalizables** (pedido nuevo del dueño, fuera del §11): destinatario editable, productos en texto libre, título,
  fecha, nota al pie y vista previa. Las líneas de texto se suman después del descuento; las preferencias (título, nota,
  datos de pago) se guardan en `localStorage`, sin base.
- **URL malformada.** `/producto/100%25` o `/producto/%E0%A4%A` responden 500 del enrutador de Next («failed to decode param»)
  antes de llegar a la página. Ninguna referencia real lleva `%` y no se amplía el proxy a `/producto` (cada prefetch pasaría por
  él).
- **Selector en una columna** también en el diálogo de escritorio (el §6.6 pedía dos): la columna de compra mide unos 400 px.
- **Producción.** La v5 ya está publicada, con los departamentos aplicados (26 categorías, 370 productos).
