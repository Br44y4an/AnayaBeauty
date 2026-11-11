# Estudio completo de Anaya Beauty

Catálogo web de maquillaje y accesorios que vende por lives con QR (Next.js 16.3 y Supabase).
10 de noviembre de 2026 · rama `rediseno-catalogo` · Para el dueño del proyecto y la dueña del negocio.

**Alcance.** Diez revisiones de solo lectura: tienda, comparativo con 11 tiendas de belleza, diseño y textos, código, arquitectura Next.js, datos, panel, una crítica cruzada y dos investigaciones de fondo (tonos y negocio). Solo se hicieron consultas SELECT, nadie pulsó «Confirmar» y no se tocó el código. No hubo pruebas con clientas: los toques salen de recorrer la tienda. Las rutas `src/...` son del repositorio; las capturas se citan relativas a la carpeta de la sesión indicada en la sección 8.

Contenido: 1. Resumen · 2. Cómo compra hoy una clienta · 3. Marcas grandes · 4. Diagnóstico (4.1 a 4.9) · 5. Decisiones · 6. Tareas de la dueña o el dueño · 7. Qué medir · 8. Anexo.

---

## 1. Resumen ejecutivo

Comprar no se complica por el número de pasos: el pedido se confirma en una sola pantalla, sin cuenta y con 3 campos, mejor que en las marcas grandes. Se complica antes, al orientarse y elegir, y por el ruido que la clienta encuentra desde la primera pantalla.

Los cinco problemas que más pesan:
1. El banner pide «código… para abrir bolsa · Es con 10k»: un paso que la web ya no tiene y una regla que nadie definió.
2. La búsqueda es literal: la referencia del live falla si no se escribe con el guion exacto (lo lleva el 77 % de las referencias), y «pestanina» o «labiales» dan 0 resultados.
3. La primera pantalla no muestra productos (el primero asoma a 734 de 844 px) y, al bajar, lo fijo tapa un tercio.
4. El tono se elige a ciegas: el 40 % se llama «Tono N», la foto que sirve de leyenda se ve a 96 px y recortada, y el agrupado por color desordena 24 de los 26 productos con 10 o más tonos.
5. Se pierde el contexto: la foto no abre el producto, las 26 categorías van en una fila de 3.949 px y al volver de una ficha se pierde lo cargado.

Tres riesgos graves. Uno: el registro de Supabase está abierto y cualquier sesión tiene permisos de administradora, con acceso a los datos de todas las clientas y a la cuenta de pago. Dos: la clave de diagnóstico está publicada en `SETUP.md`, en un repositorio público, y unas 50 llamadas agotan la cuota del correo que avisa cada pedido, que hoy es el único aviso porque Realtime está apagado. Tres: se cobra sin reglas escritas. Nadie definió los $10.000, el envío no tiene precio ni plazo y la web pide transferir un total que no lo incluye, sin lo que exigen las leyes 1480 y 1581.

Qué se decidió: cerrar primero esos riesgos; rediseñar sobre la base actual, conservando la lógica de precios, la bolsa en el navegador y la confirmación en una pantalla; empezar por lo que orienta (cabecera sin el banner, búsqueda normalizada, tarjeta que abre la ficha, categorías agrupadas y ficha que no pierde la lista); seguir con tonos, bolsa y pago; y dejar a la dueña las decisiones de negocio y la limpieza de tonos (sección 6). El detalle queda en la sección 5.

---

## 2. Cómo compra hoy una clienta

Medido en `localhost:3000` a 390×844 px contra la base real. El recorrido T5 se leyó del código, porque nunca se confirmó un pedido. Los toques propuestos salen del flujo objetivo de la auditoría de experiencia.

| Recorrido | Hoy | Propuesto | Fricción que más pesa |
|---|---|---|---|
| T1. Encontrar un lip gloss y agregar 2 unidades en dos tonos | 7 toques | 5 | El chip está a 3 deslizamientos; «Tono 1…6» sin foto por tono; el segundo tono exige descubrir «Cambiar» |
| T2. Ver el detalle y la foto antes de decidir | 4 toques y 2 scrolls | 2 | La foto abre un visor sin precio ni botón; la ficha solo se abre desde un enlace de 21 px de alto; al volver se pierde la lista |
| T3. Encontrar la referencia que dijo la anfitriona | 3 toques; falla 3 de cada 4 veces | 2 | Búsqueda literal: «usk621» o «GLS 735» dan 0 |
| T4. Revisar la bolsa, cambiar una cantidad y llegar a confirmar | 6 toques y 1 o 2 scrolls | 5 (3 con datos guardados) | «Confirmar» aparece antes del formulario; «−» borra sin deshacer; nada dice cuánto vale el envío |
| T5. Pagar y enviar el comprobante | 5 toques y 2 a 4 scrolls | 3, sin scroll | El pago es el tercer bloque; solo se copia la llave; la página se pierde si se cierra la pestaña |

**T1. Lip gloss en dos tonos.** El chip «Lip gloss» está en x=1.273 de una fila de 3.949 px. Al tocarlo, la página vuelve arriba y el chip activo se sale de la vista (`auditor-ux/out4/p4-tras-chip.png`). Son 27 productos, varios con nombres y fotos casi iguales; los tonos del elegido se llaman «Tono 1…6» y la miniatura de la hoja mide 96 px y no se amplía (`auditor-ux/out5/p5-hoja.png`). Después de agregar, el botón dice «Cambiar» (`src/components/catalogo/TarjetaProducto.tsx:198-206`), al reabrir ningún tono aparece marcado y la cantidad aplica a un solo tono: dos tonos obligan a abrir la hoja dos veces. Propuesta: Labios → «Elegir tono» → «+» en el tono A → «+» en el tono B → «Agregar 2 · $16.000», con cantidad por tono y un contador de lo que ya está en la bolsa.

**T2. Detalle y foto.** La foto abre un visor con solo «×» (`src/components/ui/VisorImagen.tsx:52-106`; `auditor-ux/out5/p5-visor.png`). La ficha solo se abre desde el nombre, un enlace de 149×21 px (`TarjetaProducto.tsx:159-168`). En la ficha, en celular, los tonos empiezan en 871 px y «Agregar» está en 1.337 px, sin barra fija. Volver con Atrás después de usar «Ver más» deja «Viendo 24 de 372» (`auditor-ux/out3/p3-tras-atras.png`). Propuesta: tocar la tarjeta abre la ficha como modal con URL propia; cerrar o Atrás devuelve al mismo producto de la lista.

**T3. La referencia del live.** «usk621», «lg 169», «gls 735» y «GLS-735» dan 0 resultados; solo funciona escribir la referencia exacta (`src/lib/data/busqueda.ts:42-48`). 286 de 372 referencias (77 %) llevan guion o espacio. El buscador empieza en 530 px y no está dentro de un formulario (`Buscador.tsx:71-82`), así que la tecla «Buscar» del teclado no hace nada, y el vacío solo sugiere «una palabra más corta» (`auditor-ux/out2/p2-gls-espacio.png`). Propuesta: buscador en la cabecera fija con sugerencias normalizadas, con foto y precio, y una fila «En el live ahora» como atajo de un toque.

**T4. De la bolsa a confirmar.** La barra fija dice «Confirmar» desde el inicio, aunque con 2 líneas el primer campo está en 861 px y el botón del formulario en 1.277 px (`src/app/carrito/VistaCarrito.tsx:668-690`; `auditor-ux/out5/p5-carrito.png`). «−» con 1 unidad borra la línea sin aviso ni deshacer (l. 374-380). Dos tonos del mismo producto se ven como dos tarjetas iguales que solo dicen «Tono: Tono 1» y «Tono: Tono 3». Solo se pide la ciudad. Propuesta: líneas agrupadas por producto, stepper con mínimo 1 y papelera con «Deshacer», una barra que dice «Completar mis datos» hasta que el formulario es válido y luego «Confirmar pedido · $X», y el envío explicado junto al total.

**T5. Pago y comprobante.** En `src/app/pedido/[id]/page.tsx` el bloque de pago es el tercero y «Enviar mi comprobante» va al final (l. 110-211). «Comprobante» nombra dos cosas: el número de pedido (l. 56-58) y el soporte de pago (l. 202). Solo se copia la llave, no el valor (l. 116). El mensaje de WhatsApp no lleva el enlace del pedido ni pide la captura (l. 40-42). Al confirmar se vacía la bolsa y no existe «Mis pedidos»: si la clienta cierra la pestaña para ir al banco, pierde la página de pago. Propuesta: tarjeta de pago arriba con «Copiar llave» y «Copiar valor», mensaje con número, total, enlace y «adjunta la captura», y el enlace del pedido guardado en el celular.

Los cinco recorridos comparten tres causas: lo primero que se lee confunde, la lista se pierde al navegar y el tono no se puede leer en la foto. El flujo objetivo sigue cuatro principios: una decisión por pantalla; la lista nunca se pierde; un solo término por concepto («bolsa», «precio por cantidad», «tono» en maquillaje y «color» en accesorios); y el botón principal siempre a la vista, con un texto que dice el estado.

---

## 3. Lo que hacen las marcas grandes y qué se adopta

Se compararon 11 tiendas en celular (390×844): Sephora US, MX y ES, Ulta, MAC, Fenty, Rare Beauty, Glossier, Natura CO, Ésika CO y Atenea, una marca colombiana con tienda propia. Se cruzó con Baymard (listas, filtros, vistas rápidas, tonos en belleza 2026, búsqueda, abandono y checkout), NN/g y TikTok Newsroom. Capturas en `benchmark/out/`. La conclusión coincide con los recorridos: el flujo de Anaya ya es corto, unos 6 toques del QR al pedido. Lo que falta es orientación.

| Patrón de las marcas grandes | Quién lo hace | Qué se adopta en Anaya |
|---|---|---|
| Encabezado fijo de 48 a 70 px con buscar y bolsa con contador; promociones en una franja de una línea | Sephora, Ulta, Fenty, Rare Beauty, Glossier, Natura, Ésika, Atenea | Barra de 56 px con logo, buscador y bolsa con número; beneficios en una línea en vez de 3 tarjetas |
| 6 a 9 grupos de categorías por zona de uso, con «Ver todo» primero | Sephora MX, Atenea, Fenty, Rare Beauty, Natura | 7 grupos con subcategorías (Baymard: solo el 24 % de los sitios resuelve bien «Ver todo») |
| Búsqueda que acepta código, errores y nombres alternos; el código se ve pequeño en la ficha | Sephora, Ulta, Natura, Atenea | Búsqueda normalizada con sinónimos; «Ref.» en gris (Baymard: el 12 % de los sitios falla incluso en búsquedas exactas) |
| Tarjeta plana: foto y nombre llevan a la ficha; «N tonos» en texto | Sephora, Ulta, Fenty, Natura, Atenea | La tarjeta abre la ficha; «6 tonos» o «4 colores»; sin la insignia «Combo» |
| Agregar desde la lista con una vista rápida; Baymard pide que enlace a la ficha completa y que Atrás la cierre | Ulta, Fenty, Natura, Ésika, MAC | Ficha como modal con URL propia, que se cierra con Atrás |
| Tandas con «Cargar más» y regreso al mismo punto | Sephora, Ulta, Atenea, Fenty | Se conservan las tandas de 24 y no se pierden al volver (Baymard: el 13 % de los sitios devuelve al inicio, y eso causó abandonos) |
| Barra fija en la ficha con el tono elegido y «Agregar · precio» | Sephora ES, Rare Beauty, Fenty, Natura, Atenea | Barra fija «Agregar · $X»; sin tono elegido, el botón abre el selector en vez de quedar deshabilitado |
| Cada oferta descrita una sola vez, junto al precio | Baymard: el 19 % de los sitios repite la oferta | Un bloque de precio por cantidad con «los tonos suman» |
| Confirmación al agregar que no bloquea, con foto, tono y cantidad | Fenty; NN/g | Aviso «Agregado: … · Ver bolsa» que dura hasta el siguiente toque |
| Envío y fecha de entrega antes de pagar | Atenea, Natura, Sephora ES | Línea «Envío» en la bolsa y en `/pedido` (Baymard: el 40 % abandona por costos extra y el 12 % por no ver el total antes) |
| Fondo neutro, un solo color de marca y fotos sobre el mismo fondo | Sephora, Fenty, Rare Beauty, Glossier, Ulta, Atenea | Página blanca y fucsia reservado a la acción principal |
| Lo que se muestra en el live se compra sin buscarlo | Fenty («as seen on TikTok»), TikTok Shop | Fila «En el live ahora» que la anfitriona marca desde el panel |

**Dónde Anaya ya está mejor.** La compra sin cuenta, con 3 campos y una nota, el total fijo abajo y «Qué pasa después» (`antes/09-carrito.png`). Según Baymard, el 18 % abandona si le exigen crear cuenta y el 17 % porque el checkout es largo; el ideal son 7 u 8 campos, frente a 14,88 de promedio en EE. UU. No hay que agregar pasos.

**Qué no se copia.**
- Modales de venta cruzada al agregar, como «Completa tu rutina» de Atenea (`benchmark/out/add-atenea/atenea-tras-agregar.png`). NN/g: se confunden con lo que ya está en la bolsa, y en pleno live son otra barrera.
- Botones flotantes que tapan contenido sin reservarle espacio, como la píldora «Ver mi pedido» de hoy.
- Pestañas por familia de color (MAC) y descripciones generadas desde el color («Tono 3 · rosado claro»): en Anaya el agrupado rompe el orden de la foto en 24 de 26 productos, y la descripción se repite entre tonos en 61 de 83 maquillajes (sección 4.3).
- Puntos de color en la tarjeta (Atenea): solo el 29 % de los productos con varios tonos tiene colores confiables, y la v4 los quitó por una queja directa (`Funcionalidades.md:179-187`).
- Insignias que salen en todas las tarjetas y emoji como ícono, que suenan a plantilla; y botones negros, que borran el reconocimiento del fucsia.
- Galerías con modelo y muestras sobre piel: no son realistas con una foto por producto. El paso barato es una segunda foto con todos los tonos, tomada en una sola sesión, para los más vendidos.

**Límites.** No hubo pruebas con clientas. Sephora en escritorio y las marcas de L'Oréal bloquearon el navegador automatizado, y Yanbal redirigió a una página corporativa. La cifra de McKinsey sobre conversión en lives no se pudo verificar y no se usa. Baymard no tiene artículos públicos sobre la barra fija de «Agregar» ni sobre precios por escalones: esos dos patrones se apoyan en lo observado.

---

## 4. Diagnóstico por área

Severidad: **crítica**, rompe la compra o expone datos o dinero hoy; **alta**, frena la compra o la operación con frecuencia; **media**, fricción o deuda que encarece cada cambio; **baja**, pulido.

**Lo que funciona y se conserva.**
- La confirmación en una sola pantalla y sin cuenta.
- El precio y el stock se deciden en una sola función SQL; después de la v4, `crear_pedido` y `cancelar_pedido` solo los ejecuta `service_role`, y las lecturas públicas no tienen consultas N+1.
- La lógica pura está probada: `npm test` pasa 211 de 211 y `tsc --noEmit` no da errores. `pricing.ts`, `discounts.ts` (coincide al peso con `crear_pedido`), `carrito/reconciliar.ts`, `tonos.ts`, `busqueda.ts` y `paginacion.ts` se quedan como están.
- La bolsa vive en el navegador: agregar es instantáneo y aguanta mala señal, y el precio lo recalcula la base.
- Las tandas de 24 con «Ver más» y contador, el `<select>` nativo para ordenar y los enlaces reales en las categorías.
- Texto de 16 px, objetivos táctiles de 44 px y contraste AA en los colores base, pensados para un público de más de 40 años.

### 4.1 Experiencia de compra

**Crítica · El banner pide un código y dice «Es con 10k».** `public/banner.png`, que `src/components/catalogo/Encabezado.tsx:15-23` pinta arriba de todo, dice «Solita código a este número para abrir bolsa · Es con 10k», con errata incluida. Es lo primero que se lee en celular y en escritorio (`antes/01-catalogo-inicio.png`, `antes/10-escritorio-inicio.png`). La v4 quitó el código (`Funcionalidades.md:18-26`) y, en la misma pantalla, la cinta promete «sin cupones ni códigos» (`CintaBeneficios.tsx:39`). Impacto: quien llega del live entiende que antes de pedir debe escribir por WhatsApp y pagar $10.000; abandona o satura el chat antes de tocar un producto. Propuesta: cambiar el banner por una cabecera compacta con el logotipo. Qué decir de los $10.000 lo decide la dueña (secciones 4.9 y 6).

**Crítica · La búsqueda no encuentra la referencia del live ni palabras comunes.** Busca la frase entera con `ilike` sobre nombre y referencia (`busqueda.ts:42-48`, `catalog.ts:159`): no quita guiones ni espacios, no ignora tildes, no mira la categoría y exige las palabras en el mismo orden. Probado contra la base real: «usk621», «lg169», «lg 169», «gls 735» y «GLS-735» dan 0; «pestanina», «rimel», «mascara», «labiales» y «brocha polvo», también; «gloss» trae 3 de los 27 lip gloss. 141 nombres activos (38 %) llevan tilde o ñ. Además, el campo borra letras a quien escribe despacio: «lab», una pausa de 420 ms y «ial rojo mate» terminan en «labrojo mate» (sección 4.4). Impacto: la acción principal durante un live termina en «No encontramos nada», y la clienta concluye que el producto no existe. Propuesta: búsqueda normalizada (sección 4.6), sugerencias con foto mientras escribe, abrir el producto si la referencia coincide exacta y, en el vacío, categorías y WhatsApp.

**Alta · Tocar la foto no abre el producto.** La foto de la tarjeta (173×173 px) abre un visor con «×» y «Toca fuera de la imagen para cerrar» (`TarjetaProducto.tsx:103-151`). La única entrada a la ficha es el nombre, un enlace de 149×21 px, y ni la hoja de compra ni la bolsa enlazan a la ficha. En las siete tiendas del comparativo donde se revisó el código, la foto lleva a la ficha. Impacto: ver un producto cuesta 3 toques (foto, cerrar, nombre); es fácil no descubrir la ficha y decidir mirando una miniatura de 96 px. Propuesta: toda la tarjeta abre la ficha como modal con URL propia, y el zoom vive dentro de la ficha.

**Alta · Elegir dos tonos exige descubrir «Cambiar» y adivinar qué color es «Tono 3».** Al reabrir la hoja, ningún tono aparece marcado y «Ya llevas de este producto» queda bajo el pliegue (`HojaCompra.tsx:259-291`; `auditor-ux/out5/p5-hoja-cambiar.png`). 538 de 1.340 tonos (40 %) se llaman «Tono N» y ningún producto tiene foto por tono. En el caso extremo, PCL-885, la cantidad queda a 3,2 alturas de hoja (`auditor-ux/out7/p7-hoja-36.png`). Impacto: el 66 % de los productos tiene tonos, y hoy se eligen sin ver el color real; eso produce errores y consultas por WhatsApp. Propuesta: selector con cantidad por tono, contador de lo que ya está en la bolsa y un solo «Agregar N · $X»; después de agregar, «Agregar otro tono». La foto como leyenda se trata en la sección 4.3.

**Alta · La primera pantalla no muestra productos y al bajar lo fijo tapa un tercio.** A 390×844 hay un banner de 163 px, «Consiéntete hoy» y 3 tarjetas de beneficios; el buscador empieza en 530 px y la primera tarjeta en 734 px, y esa tarjeta es el único producto activo sin foto (`antes/01-catalogo-inicio.png`). Al bajar, la zona fija de buscador, chips y «Ordenar» (`src/app/page.tsx:58-84`) mide 200 px (24 %) y la píldora «Ver mi pedido» suma 72 px: cerca del 32 % de la pantalla queda tapado (`auditor-ux/out1/p1-sticky-scroll.png`). La píldora también tapa precios y botones (`antes/05-tras-agregar.png`, `antes/08-detalle-agregado.png`). Impacto: quien llega por el QR ve publicidad y reglas antes que productos. Propuesta: cabecera fija de 56 px con logo, buscador y bolsa con contador; beneficios en una línea; «Ordenar» fuera de la zona fija; la grilla antes de 400 px.

**Alta · 26 categorías planas en una fila de 3.949 px, y el filtro activo desaparece.** `ChipsCategorias.tsx:50-68` pinta 27 chips («Todo» y 26 categorías raíz), unos 10 anchos de pantalla. Lo de labios está repartido en 3 categorías. Al tocar un chip estando abajo, la página vuelve arriba porque el enlace no lleva `scroll={false}` (l. 125), y la fila vuelve al inicio: nada indica qué filtro está activo. Impacto: filtrar cuesta 3 o 4 gestos y cada cambio hace perder el contexto. Propuesta: 7 grupos con las subcategorías en una segunda fila, que la interfaz ya sabe pintar (`ChipsCategorias.tsx:70-93`); chip activo centrado y un título «Labios · N productos» sobre la grilla. Requiere cambiar la consulta (4.6) y el editor de categorías (4.8).

**Alta · Al volver de un producto se pierde la lista, y Atrás con la hoja abierta cambia de página.** Las tandas de «Ver más» viven solo en estado local (`ListaProductos.tsx:40-44`): con 72 productos cargados, abrir el n.º 60 y volver deja «Viendo 24 de 372» y el scroll en otra parte (también en `benchmark/out/anaya-volver/anaya-al-volver.png`). «Seguir viendo» es un enlace a `/` que borra búsqueda y categoría (`src/app/producto/[referencia]/page.tsx:47-55`). Con la hoja de tonos abierta, Atrás no la cierra sino que cambia de categoría; si la clienta entró por el QR, la saca de la tienda (`Hoja.tsx:51-80` solo atiende Escape; `benchmark/out/anaya-hoja-atras/hoja-tras-atras.png`). Impacto: comparar productos obliga a repetir filtro, «Ver más» y scroll en cada ida y vuelta. Propuesta: ficha como modal interceptado, que no desmonta el catálogo y se cierra con Atrás (4.5).

**Media · El precio por cantidad tiene cuatro nombres y «Combo» no informa nada.** «Combo» sale en 23 de 24 tarjetas porque 371 de 372 productos tienen más de un escalón (`TarjetaProducto.tsx:70` y `:134-138`); además, en Colombia «combo» significa un paquete de varios productos (Atenea, Ésika). La misma regla se llama «Mientras más llevas, menos cuesta», «mejor precio al llevar más» y «3 o más» (`CintaBeneficios.tsx:28`, `HojaCompra.tsx:113`, `TablaEscalones.tsx:29`). La tarjeta solo muestra el precio de 1 unidad, y en ninguna pantalla se dice que los tonos de un mismo producto suman para el escalón. Para volver hay tres textos distintos y la bolsa tiene tres nombres. Impacto: la clienta no entiende por qué cambia el precio ni cuánto ahorra. Propuesta: quitar «Combo»; en la tarjeta, «$8.000 c/u · 3 o más: $7.500 c/u»; un término por concepto y «los tonos suman» junto al precio.

**Media · La bolsa muestra «Confirmar» antes del formulario y borra sin deshacer.** Ver T4. El indicador de pasos marca dos pasos activos a la vez (`VistaCarrito.tsx:295-324`) y el mismo botón tiene dos textos. Impacto: toques de más, productos borrados por accidente y otra conversación por WhatsApp para la dirección y el envío. Propuesta: barra con estado, stepper con mínimo 1 y «Deshacer», tonos agrupados bajo su producto, sin indicador de pasos y con «Recordar mis datos en este celular», que exige aviso de privacidad (4.9).

**Media · Pagar y enviar el comprobante depende de una página que se puede perder.** Ver T5. Además, el WhatsApp de la tienda es una constante del código (`src/lib/format.ts:1`) y no el que se configura en el panel: hoy coinciden, pero un cambio en el panel no llega a la tienda. Impacto: la clienta va al banco, vuelve, busca el botón y adjunta todo a mano; si cerró la pestaña, pierde los datos de pago.

**Media · Barreras de accesibilidad justo en la compra.** Hay un `<button>` dentro de un enlace en `VistaCarrito.tsx:259-261` y `:714-716` y en `pedido/[id]/page.tsx:195-210`. Los mensajes de ahorro quedan a 4,34:1 en 12 px; el botón deshabilitado que da la instrucción «Elige un tono para continuar», a 2,15:1 (`Boton.tsx:50`); los placeholders, a 2,69:1 y 3,30:1. Los 17 «Elegir tono» y 7 «Agregar» de la primera tanda no nombran el producto para el lector de pantalla. El visor no mueve ni encierra el foco. Impacto: tropiezan quienes tienen baja visión o usan lector, una parte del público de más de 40 años. Propuesta: estilo de botón en el enlace, colores de la paleta AA (4.2), botón principal siempre activo que lleva al selector y `aria-label` con el nombre del producto.

**Media · En escritorio se ven 6 de 27 chips y «Ordenar» se monta encima.** A 1366×900 se lee «PestOrdenar» (`src/app/page.tsx:63-77`). El banner mide 467 px y la grilla empieza en 807 px. La ficha es una columna de 672 px y «Agregar» queda en y=1.557 (`antes/12-escritorio-detalle.png`). Propuesta: desde 1024 px, categorías en barra lateral o en filas que bajan, y ficha a dos columnas con la compra fija a la derecha.

**Baja · Agregar no confirma qué se agregó y los estados vacíos no orientan.** La hoja se cierra al agregar sin decir tono ni total (`HojaCompra.tsx:95-102`); la búsqueda vacía solo sugiere «una palabra más corta» (`ListaProductos.tsx:113-133`); `not-found.tsx` dice «Este producto ya no está» en cualquier 404, también con un pedido inexistente. Propuesta: aviso «Agregado: {producto} · {tono} · Ver bolsa»; vacíos con salida a categorías y WhatsApp; 404 según la ruta.

**Decisiones abiertas de experiencia.**
- *Dónde se elige el tono.* Hay cuatro propuestas: conservar la hoja y agregarle «Ver detalles» (comparativo); que la tarjeta abra la ficha en modal y la hoja se vuelva una lista con cantidad por tono (experiencia); elegir el tono dentro del modal y retirar `HojaCompra` y `cargarTonos` (Next.js); o dejar `PanelCompra` y `HojaCompra` como envoltorios de un mismo hook (código). Todas coinciden en una sola lógica de compra; difieren en el contenedor. Cualquiera sirve si la foto se ve completa a todo el ancho y la cantidad va por tono.
- *Taxonomía de categorías.* Hay tres versiones: 7 grupos del comparativo con conteos reales (Rostro 28, Ojos y cejas 42, Labios 43, Brochas y herramientas 69, Cabello 60, Uñas y piel 57, Bolsos y accesorios 71); otros 7 de experiencia (con Skin care y Uñas y cabello); y 8 de datos (con Otros). Se decide con la dueña.
- *Fila «En el live ahora».* No puede ser una categoría, porque cada producto tiene una sola (`supabase/schema.sql:35`): meterlo ahí lo saca de la suya. Hace falta un campo o una tabla con orden que la anfitriona marque desde el panel.

### 4.2 Diseño visual y textos (señales de «hecho por IA»)

La tienda funciona, pero su capa visual reúne casi todos los rasgos de una plantilla generada. Las mediciones son de Chrome sin interfaz sobre la portada.

**Alta · Emoji, corazones y personaje en botones, errores y mensajes.** Hay 23 líneas de texto con emoji en las pantallas de compra: destellos en cada aviso de ahorro (`TarjetaProducto.tsx:261`, `HojaCompra.tsx:123`, `PanelCompra.tsx:117`, `VistaCarrito.tsx:267` y `:472`), un corazón en el botón que cierra la venta, «Confirmar mi pedido» (`VistaCarrito.tsx:619`), y emoji en los errores (`error.tsx:29` y `:58`, `not-found.tsx:9`, `carrito/actions.ts:124,151,165`). La confirmación dice «¡Gracias por tu compra, princesa!» (`pedido/[id]/page.tsx:53` y `store_settings.mensaje_exito`) cuando la clienta todavía no ha pagado. `Iconos.tsx:4-5` deja el uso de emoji escrito como norma. Impacto: la tienda se lee improvisada y los lectores de pantalla leen cada emoji en voz alta.

**Alta · Contrastes por debajo de AA en los pasos de compra.** Calculado con la fórmula de `src/lib/color.ts`: ahorro lila sobre lila translúcido 4,34:1 y 4,13:1; fila activa de escalones 4,36:1; paso activo 4,01:1; placeholders 3,30:1 y 2,69:1; botón con hover que aclara el fucsia 4,34:1; botón deshabilitado con instrucción 2,15:1; `global-error.tsx:45` 4,10:1; bordes de campo 1,54:1, cuando WCAG pide 3:1. `contraste.test.ts` no los detecta porque no revisa opacidades, hover, bordes ni estilos en línea.

**Alta · Textos que se contradicen.** El banner pide un código y la cinta promete «sin códigos». Un error dice «para no cobrarte dos veces» y la bolsa dice «aquí no se cobra nada». Se pide el WhatsApp «con indicativo» y el ejemplo no lo trae. Se agradece «tu compra» antes del pago. El botón flotante habla de «productos» pero cuenta unidades. La página 404 dice «Este producto ya no está» aunque lo que falte sea un pedido.

**Media · Todo rosa, todo píldora y todo con sombra.** El fondo es rosa pastel en todas las vistas (`globals.css:68`). Solo en la portada hay 78 elementos en píldora y 51 con sombra rosada. En la ficha se apilan 5 cajas blancas de 24 px de radio, y «Agregar» queda a 1,58 pantallas (`antes/06-detalle.png`). Las fotos, casi todas sobre blanco, quedan como cajas blancas sobre rosa.

**Media · Una serif decorativa para todo, también para las cifras.** Títulos, totales, cantidades y número de pedido van en Playfair, que usa cifras elzevirianas: se lee «$8.ooo» y «AB-oo21» (`disenador-visual/out3/muestra-fuentes.png`, `antes/09-carrito.png`). Playfair con Nunito es la pareja «elegante y tierna» típica de plantilla.

**Media · Tres capas encima de cada foto y fotos recortadas.** «Combo», una lupa en 24 de 24 fotos y «N en tu bolsa» van sobre la imagen. `object-cover` dentro de un cuadrado recorta el producto (`TarjetaProducto.tsx:117`, `FotoProducto.tsx:42`) y el zoom al pasar el cursor es el de plantilla. El único producto sin foto abre el catálogo con un corazón lila.

**Media · Sobreexplicación.** En la hoja de tonos el escalón se dice 3 veces (`HojaCompra.tsx:113`, la tabla y el aviso de ahorro). El tono elegido se confirma con anillo, check, fondo, negrita y además «Elegiste: Rosado». Los 4 pasos del pedido salen en la bolsa y otra vez en la confirmación.

**Baja · Acabado sin pulir.** Íconos con trazos de 2 y 2,5 mezclados con figuras rellenas; un corazón reemplaza la foto en 6 sitios; nombres en mayúsculas en la primera fila («COSMETIQUERA X2»); 252 de 372 descripciones repiten el nombre del producto; la portada, que es el enlace que circula por WhatsApp, no tiene `og:image` ni `og:title`, así que el enlace no muestra vista previa.

**Sistema visual propuesto** (maquetas en `disenador-visual/out4/maqueta-catalogo.png` y `maqueta-hoja.png`):

| Rol | Color | Uso | Contraste |
|---|---|---|---|
| Fondo | `#ffffff` | Página, hoja y barra superior; reemplaza al rosa `#fdf2f7` | Base |
| Superficie | `#f7f3f5` | Teselas de foto, resumen del pedido, esqueletos | Tinta encima: 15,02:1 |
| Tinta | `#261c22` | Texto, títulos, precios, íconos, botón secundario | 16,51:1 |
| Tinta suave | `#6d5765` | «c/u», ayudas y «Ref.», siempre sin opacidad | 6,56:1 |
| Borde de control | `#8e7d88` | Buscador, campos, select y stepper | 3,86:1 (hoy 1,54:1) |
| Fucsia | `#d11a72` | Solo la acción principal, el contador de la bolsa y el anillo de foco | Blanco encima: 5,12:1 |
| Fucsia hondo | `#a8145a` | Hover y presionado del botón principal | 7,21:1 |
| Lila | `#8956b8` | Solo la etiqueta de categoría en mayúsculas y el logo | 5,14:1 |
| Ahorro | `#0f7a52` | Dinero ahorrado y confirmaciones | 5,35:1 |
| Error | `#b42318` | Errores; hoy usan el mismo fucsia del botón de comprar | 6,57:1 |

Tipografía: una sola familia, Figtree (variable, vía `next/font`), con cifras tabulares en precios, cantidades y número de pedido; salen Playfair y Nunito. Escala de 12 a 32 px, con 16 px como mínimo en el texto corrido y en los campos, para que Safari no haga zoom. Radios de 4, 8 y 16 px; superficies planas, con sombra neutra solo en el botón flotante y la hoja inferior; un solo set de íconos de línea de 1,75. Fotos en tesela cuadrada `#f7f3f5`, con `object-contain` al 88 % y `mix-blend-mode: multiply`, sin zoom ni insignias salvo «Agotado». Movimiento de 120 a 200 ms, sin rebote. Zona fija de 100 px (hoy 200). Si se renombran los colores en `globals.css`, `contraste.test.ts` falla a propósito: se actualiza en el mismo cambio y se le agregan borde, hover y error. El panel usa los mismos colores, así que también cambia.

**Tono de voz.**
- Tuteo cálido y al grano, frases de una idea: «Elige un tono», «Te faltan $12.000 para el 5 % de descuento».
- Sin emoji, corazones ni apodos («princesa», «consiéntete», «se nos enredó»), tampoco en los mensajes que se precargan en WhatsApp.
- Una sola exclamación en todo el recorrido: la de la confirmación del pedido.
- Cifras exactas en formato colombiano: $8.000, 5 %, «3 o más: $7.500 c/u». Nunca «10k».
- Botones que empiezan por verbo: Agregar, Elegir tono, Confirmar pedido, Ver bolsa, Volver a intentar.
- «Bolsa» antes de confirmar y «pedido» después; «comprobante» solo para el soporte de pago; «tono» en maquillaje y esmaltes, «color» en accesorios.

La auditoría de textos trae 165 propuestas con archivo y línea (`audit_visual_copy.json`, clave `textos`). Las de más peso:

| Dónde | Hoy | Propuesto |
|---|---|---|
| `VistaCarrito.tsx:619` | «Confirmar mi pedido» con un corazón | «Confirmar pedido» |
| `pedido/[id]/page.tsx:53` y `mensaje_exito` | «¡Gracias por tu compra, princesa!» con destellos | «¡Recibimos tu pedido!» y «Gracias, {primer nombre}.» |
| `pedido/[id]/page.tsx:57` | «Guarda este número, es tu comprobante:» | «Tu número de pedido» |
| `BotonFlotante.tsx:41` | «Ver mi pedido» (antes de confirmar) | «Ver bolsa» |
| `TarjetaProducto.tsx:136` | Insignia «Combo» | «{mín} o más: {precio} c/u» bajo el precio |
| `HojaCompra.tsx:183-186` | «Elige tu tono (4)» en una cosmetiquera | «Color · 4 opciones»; al elegir, «Color: {nombre}» |
| `producto/[referencia]/page.tsx:54` y otras | «Seguir viendo», «Seguir comprando», «Seguir viendo el catálogo» | «Volver al catálogo» |
| `not-found.tsx:13` | «Este producto ya no está» en cualquier 404 | «No encontramos esta página» |

**Decisiones abiertas de diseño.** Si el fucsia va también en el precio (el comparativo dice sí; diseño dice no). Si la bolsa va en la cabecera, en un botón flotante o en ambos (la maqueta usa ambos). Para el botón de la grilla hay acuerdo en el contorno; el negro queda descartado.

### 4.3 Tonos y fotos

La leyenda real es la foto del proveedor: el «Tono N» guardado casi siempre es una posición en ella. Ejemplos: MTE-7 guarda «Tono 3, 4, 5, 6, 11, 12, 1, 2» en el mismo orden en que la foto imprime esos números; EN-165PC no tiene el 5 ni el 7, que en la foto llevan el sello AGOTADO; PCL-885 es una cuadrícula de 6×6 con letras de fila. Se clasificaron los 244 productos activos con tonos (1.340 filas de `product_shades`, comparadas en orden con su `imagen_principal`): 89 revisados a tamaño real (los 26 con 10 o más tonos, 24 de maquillaje y 24 de accesorios sorteados con semilla fija, y 15 citados) y 155 en miniatura. La extrapolación por estratos, con intervalos del 95 %, contiene el conteo completo en todas las clases.

| Clase | Qué es | Productos | Filas | Maquillaje | Accesorios |
|---|---|---|---|---|---|
| A | Número o letra impresos que coinciden con los nombres | 35 (14 %) | 186 | 21 | 14 |
| B | Posición en una sola fila, sin ambigüedad | 48 (20 %) | 187 | 24 | 24 |
| C | Posición ambigua: varias filas, cuadrícula o caja exhibidora | 54 (22 %) | 446 | 22 | 32 |
| D | Nombres de color o de diseño reales | 107 (44 %) | 521 | 17 | 90 |
| E (bandera aparte) | Incoherente con la foto: AGOTADO, variantes que sobran o faltan | 33 (14 %) | — | 12 | 21 |

Lectura: en maquillaje, 61 de 84 productos se llaman «Tono N» y su significado depende de la foto. En accesorios mandan los nombres reales (56 %), y lo que falla es el color guardado y la foto. La hoja de contacto con 12 casos reales y su regla está en `tonos-leyenda/salida/hoja-contacto-tonos.png`.

**Alta · La foto que hace de leyenda se ve a 96 px y recortada en cuadrado.** `HojaCompra.tsx:151-158` la pinta en un cuadrado de 96 px con `object-cover` (medido en vivo: `tonos-leyenda/vivo/h01-hoja-PCL-885.png`). La tarjeta y la ficha también recortan: 176 de 244 fotos pierden el 20 % o más del lado largo (mediana 24 %), y lo que se pierde es la leyenda: las letras K a P de PCL-885, la columna de muestras de MTE-7 y las miniaturas de color de KC7002 (`tonos-leyenda/vivo/cuadrados.png`). En la clase C el número solo se resuelve contando sobre la foto. El pedido AB-0097, del 10-nov, pidió «PRF-IL Tono 2», que es el frasco azul si se lee por filas o el transparente si se cuenta de izquierda a derecha. De las 40 líneas reales con tono, 23 son «Tono N» o «Tono N modelo X». Impacto: en el celular la clienta no puede leer ni contar la leyenda, y el pedido llega con un tono que la dueña tiene que confirmar por WhatsApp. Propuesta: foto completa a todo el ancho, con marcas numeradas tocables sobre cada artículo y zoom hasta 2 veces (el 85 % de las fotos mide unos 500×380 px y más zoom solo agranda píxeles). A todo el ancho, los números impresos de MTE-7 pasan de unos 5 px a unos 15 px.

**Alta · Los agotados se marcan borrando tonos, y eso renumera la foto.** 16 fotos traen el sello AGOTADO del proveedor; en 14, esos tonos ya no están en la base, pero PC908 sigue vendiendo el «Tono 7» y GE-7208 la «Gema C», los dos con sello. PCL-989-3 quedó renumerado: su «Modelo I tono 3» es la 5.ª columna de la foto. KC7002, BAO-643, SOM-899, ER-30P y PX123 quedaron con un solo tono, que la hoja elige sola (`HojaCompra.tsx:58-60` y `:70-72`), aunque la foto muestra 3 o 4 variantes. 13 descripciones anuncian más tonos de los que hay. Cada guardado borra y vuelve a insertar los tonos con id nuevo (`productos/actions.ts:154-159`), la bolsa identifica la línea por ese id (`cart.ts:42-43`) y `crear_pedido` copia el nombre del tono sin comprobar que exista (`supabase/migracion-v4.sql:263`). Ejemplo: el 10-sep se pidió KL-004 en un color que hoy ya no existe en la base. Propuesta: una bandera «agotado» por tono, sin stock por tono; guardar los tonos por id; que `crear_pedido` valide el tono; y si queda uno solo, decir cuál queda en vez de elegirlo en silencio.

**Alta · Agrupar por familia de color desordena 24 de los 26 productos con 10 o más tonos.** El agrupado se activa desde 10 tonos (`tonos.ts:140-158`, `SelectorTonos.tsx:41-46`). En vivo, PCL-885 queda en 5 grupos con 24 de sus 36 tonos en «Neutros» (`tonos-leyenda/vivo/h03-hoja-PCL-885-neutros.png`); en HWI-362 las flores amarillas caen en «Naranjas» porque el color se tomó del centro de la flor; NO.2IN1, con 21 números impresos en orden, se reparte en 5 grupos. Ningún producto con nombres reales de color pasa de 12 tonos, así que no hay caso en que agrupar ayude. Propuesta: quitar el agrupado y mostrar los tonos en el orden de la foto; en las cuadrículas, una matriz con las letras impresas en las filas y los números en las columnas.

**Media · «Tono» es la palabra equivocada en unos 43 productos, y 13 tienen dos ejes en una lista plana.** La hoja siempre dice «Elige tu tono», también para una cosmetiquera. En una misma categoría conviven colores, aromas y diseños (Skin care), códigos y largos (Pestañas) o paletas enteras (Sombras). Los 13 productos con dos ejes (PCL-885, PCL-989 y sus tres variantes, CAM-601, ENC205, SPC55, FIG244, FIG244-2, AC-U1902, USK-208 y KL-370) suman 205 filas con nombres como «Tono 4 modelo M». Propuesta: una etiqueta por producto (Tono, Color, Diseño, Modelo, Aroma, Largo o Paleta) con valor por defecto según la categoría, y un segundo eje modelo × color dentro del mismo producto. Partirlos en varios productos rompe el precio por cantidad: quien mezcla modelos de PCL-885 perdería el precio de 3 o más.

**Media · El color guardado no es fiable: 200 filas no salen de la foto.** 50 filas tienen el valor por defecto del formulario (`#E5308A`, `FormularioProducto.tsx:337`), 48 se movieron con el deslizador a partir de él y 102 salen de un diccionario (el mismo «Morado» en 19 productos, «Rosado» en 16 y «Azul» en 14). Están en 75 de 160 accesorios y en 9 de 84 maquillajes. Hay colores mal tomados: LAS-944 «Celeste» se pinta fucsia; en HWI-362 se tomó el centro de la flor y en POS-739, el adorno. Propuesta: no construir interfaz sobre ese dato; mostrar el círculo de color solo si se tomó de la foto y se distingue de sus vecinos, y poner un gotero en el editor.

**Media · 33 productos tienen una foto que no cuadra con lo que se vende.** Además de los 16 con AGOTADO, 17 muestran variantes que no se venden o esconden las que sí: LIP-331 tiene 12 frascos y 6 tonos; FIG244 y KL-370 muestran un modelo que no está a la venta; DEL-439 y DEP-033 muestran el negro, que no se vende. En los 89 revisados hay 41 collages con exhibidor o empaque y 19 con el recuadro blanco del sello borrado, casi siempre sobre el artículo 1; `Catalogo_Engol.xlsx` (hoja «Logo_en_producto») confirma que el sello del proveedor se borró de todas las imágenes. 207 de las 244 fotos son recortes del catálogo del proveedor de unos 500×380 px.

**Baja · La leyenda impresa se usa a medias.** NO.2IN1 y LPZ-80 imprimen «01 BLACK» y «12 CELESTE» pero guardan «Black» y «Celeste»; WEEK-7 imprime los días de la semana y guarda «Tono 1…7»; LPL-279 y STYLE444 tienen el orden al revés que la foto. Se corrige hoy desde el editor.

**Reglas por clase.**
- **A:** conservar exactamente lo impreso («11», «1.1», «Gema C», «01 Black») y resaltar la marca sobre la foto al elegir.
- **B y C de maquillaje** (46 productos, 268 filas): conservar «Tono N», porque es la clave que llega en el pedido y no hay un nombre real que poner; el número tiene que verse sobre la foto. En C, las marcas tocables son obligatorias. Si el producto físico trae un código de tono, manda el código.
- **B y C de accesorios** (47 productos «Tono N», 193 filas): renombrar al color visible («Rosado», «Negro», «Durazno») en el orden de la foto, como ya hacen los 90 accesorios de la clase D.
- **D:** conservar los nombres; acortar los largos y separar los casi iguales («Conejo» y «Conejos»). En diseños, una miniatura recortada de la foto en vez de un círculo; buscador solo con más de 12 nombres.
- **E:** primero se corrigen los datos y la foto; después se nombra. Los agotados se ven atenuados con su número.

**Qué se descarta y por qué.** Renombrar todos los «Tono N» a colores, como proponían las auditorías de experiencia y de diseño, rompe la correspondencia con la foto en maquillaje. Generar «Tono 3 · rosado claro» desde el color, como proponía el comparativo, repite la descripción entre tonos en 61 de 83 maquillajes. Poner 6 muestras de color en la tarjeta, como proponía la auditoría de datos, no vale la pena: solo 69 de 239 productos con 2 o más tonos (29 %) tienen todos sus colores tomados de la foto y distinguibles, 41 de 83 maquillajes tienen un par indistinguible y la v4 quitó los círculos por una queja (`Funcionalidades.md:179-187`). En la tarjeta basta el texto «8 tonos», «4 colores» o «30 diseños».

**Herramienta nueva para el panel: «leyenda de la foto».** Foto grande; tocar cada artículo para poner su marca y su recorte; gotero para el color; arrastrar para ordenar; interruptor de agotado; modo cuadrícula para dos ejes; guardado por id. Hoy el editor (`FormularioProducto.tsx:278-342`) permite renombrar, cambiar el color a mano, quitar, agregar al final y subir otra foto, pero no reordenar, marcar agotado sin borrar, conservar los id, poner una etiqueta por producto, un segundo eje, ubicar el tono sobre la foto ni tomar el color con gotero.

### 4.4 Código de la tienda

**Línea base.** `npm test` (Vitest 4.1.11) pasa 211 de 211 pruebas en 19 archivos, en 28 a 33 s; `npx tsc --noEmit` termina sin errores. Los problemas están en los componentes cliente de la compra, no en la lógica de negocio. Siete fallos se comprobaron en el navegador (`auditor-codigo/out/`).

**Alta · El buscador borra lo que escribe una persona lenta (verificado).** `Buscador.tsx:36-38` copia la URL al campo en un efecto y `:40-60` programa la espera en otro. Cuando llega `?q=lab`, el campo vuelve a «lab» y se cancela lo pendiente (`auditor-codigo/out/b2/b1-buscador.png`). Afecta justo al público objetivo, que escribe despacio en el celular. Propuesta: el estado local manda mientras el campo tiene foco, y la espera va en el manejador del cambio.

**Alta · Al volver del detalle se pierden las tandas cargadas (verificado).** `ListaProductos.tsx:40-44` las guarda solo en estado de React; los `delete('pagina')` de `Buscador.tsx:51`, `OrdenProductos.tsx:36` y `ChipsCategorias.tsx:42` muestran que la URL dejó de llevar la página (`auditor-codigo/out/f/f1-tras-volver.png`). Propuesta: ficha en modal interceptado o la cantidad cargada en la URL.

**Alta · Los botones «Reintentar» no reintentan (verificado).** La bolsa se carga en un efecto que solo depende de los ids (`VistaCarrito.tsx:80-91`), y el botón llama `router.refresh()` (`:126`), que no lo vuelve a ejecutar: tras restablecer la red no salió ninguna llamada (`auditor-codigo/out/a/a2-tras-reintentar.png`). `error.tsx:40` y `global-error.tsx:39` usan `reset`; en Next 16.3 la que vuelve a pedir el contenido es `retry()`, estable desde la 16.3.0 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:117-121`). Impacto: con mala señal, la clienta queda atrapada con un botón que no hace nada.

**Alta · La lógica de compra está copiada en tres componentes y ya divergió.** `PanelCompra.tsx:23-80`, `HojaCompra.tsx:32-102` y `TarjetaProducto.tsx:61-93` repiten estado, disponible, precio y agregar. La hoja recorta la cantidad a lo disponible y el panel no; la hoja elige sola el único tono (dos veces) y el detalle no; «necesita tono» se define distinto; el escalón vigente se reimplementa en vez de usar `pricing.ts:38-49`; hay tres textos de ahorro. Propuesta: una función pura `resumenDeCompra()` y un hook `useCompraProducto`; los componentes quedan como envoltorios.

**Alta · `VistaCarrito.tsx` hace de todo.** 737 líneas, 12 componentes y 4 efectos que orquestan la compra: la carga sale durante la hidratación con ids vacíos, la clave de envío se genera en un efecto (en el primer render puede ir vacía) y navegar y vaciar la bolsa reaccionan al resultado en otro. No tiene pruebas. Propuesta: `useBolsa`, `useConfirmarPedido` y `components/bolsa/*`.

**Media · Dos pestañas se pisan la bolsa (verificado).** `cart.ts:57-137` guarda en `localStorage` pero no escucha el evento `storage` (el `persist` de Zustand 5.0.15 no lo hace): quien abre un producto desde WhatsApp en otra pestaña pierde lo que ya había elegido (`auditor-codigo/out/e/_log.json`). Propuesta: escuchar `storage` y rehidratar.

**Media · La hoja y el visor sacan el foco del diálogo (verificado).** El efecto de `Hoja.tsx:39-84` depende de una función que `TarjetaProducto.tsx:274` y `:279` recrean en cada render; al quitar un tono, el foco salta a un botón detrás del velo (`auditor-codigo/out/c/_log.json`). `VisorImagen` no encierra el foco: son dos modales hechos distinto. Propuesta: una base `Dialogo` sobre `<dialog>` nativo.

**Media · Errores tragados: el total que se ve puede no ser el que se cobra.** `catalog.ts:242-246` (ajustes) y `:252-256` (reglas de descuento) devuelven vacío si la consulta falla; la bolsa calcula con eso y `crear_pedido` aplica las reglas reales. Propuesta: fallar a la vista, nunca en silencio.

**Media · Confirmar espera al correo.** `src/app/carrito/actions.ts:251-276` hace otra consulta y espera a Resend antes de responder. Propuesta: moverlo a `after()`.

**Media · Tipado débil en la frontera con Supabase.** Los clientes no usan el tipo `Database` y hay conversiones `as unknown as` en 8 sitios (`catalog.ts:186` y `:217`, `orders.ts:90` y `:120`, `carrito/actions.ts:77`, entre otros). `tsc` pasa aunque cambie una columna o la firma de `crear_pedido`, como pasó en la v4. Propuesta: `supabase gen types`.

**Media · Sin ESLint y con hooks llamados `usar*`.** `package.json` no incluye ESLint, y `usarCarrito` o `usarLineasDeProducto` no se reconocen como hooks: nada vigila las dependencias de los efectos, que es el origen de los fallos del buscador, la bolsa y la hoja. Propuesta: renombrar a `use*` y agregar `eslint-config-next`.

**Media · Duplicaciones que ya se desincronizaron.** La expresión de UUID está 3 veces, la vibración 4, los selectores de cantidad 3, el umbral de $200.000 4 veces y los pasos, el pago y los totales 2 veces (bolsa y `/pedido`). La paleta vieja sigue en el PDF, el correo y `global-error.tsx`. La ruta del producto va codificada en la tienda y sin codificar en el panel (`productos/actions.ts:223`).

**Media · «Tono» para todo y textos dentro de la lógica.** «Elige tu tono» sale en una cosmetiquera (`auditor-codigo/out/c/c1-hoja-con-linea.png`); `discounts.ts:143` y `:150` devuelven frases; los mensajes de error de `carrito/actions.ts` llevan emoji. Propuesta: «variante» en el código, con una etiqueta por producto, y los textos en archivos de textos.

**Baja · Restos de la v4 y código muerto.** `Pedido.codigoUsado` y el join a `access_codes` (`orders.ts:10,30,45,61`), «/confirmar» en `BotonFlotante.tsx:10`, funciones e íconos sin uso, `public/banner.jpg`, colores y animaciones sin referencias y `supabase/tests.sql` obsoleto. `Funcionalidades.md` está desactualizado: da por seguro el importador, por activo Realtime y por buena la caché. Los redirects `/confirmar` y `/c/:codigo` se conservan, porque siguen circulando enlaces viejos por WhatsApp.

**Baja · Comentarios-ensayo y comentarios falsos.** Bloques de 15 a 37 líneas que cuentan la historia, y datos viejos: «591 productos» (hoy hay 372), referencias al «middleware» o a una normalización del WhatsApp que no ocurre.

**Baja · El esqueleto del catálogo aparece al ir a la bolsa (verificado: a los 86 ms).** `src/app/loading.tsx:5-16` envuelve también `/carrito` y `/pedido/[id]`.

**Baja · Pruebas lentas y sin red donde se va a rehacer.** Las 19 pruebas cargan jsdom aunque 16 son lógica pura (125 a 152 s acumulados de entorno). No hay pruebas de `VistaCarrito`, `HojaCompra`, `Buscador`, `ListaProductos`, `carrito/actions.ts` ni `error.tsx`.

**Pruebas que se romperán a propósito.** `TarjetaProducto.test.tsx` (12) exige que la tarjeta muestre «$10.000» y no «$9.000», lo que hoy prohíbe el precio por cantidad en la tarjeta. `SelectorTonos.test.tsx` (11) fija el agrupado desde 10 tonos que la sección 4.3 recomienda quitar. `contraste.test.ts` (19) fija los nombres de los colores. `PanelCompra.test.tsx` (12) y `order-template.test.ts` (9) fijan textos. Se actualizan en el mismo cambio; las de `pricing`, `discounts`, `busqueda`, `paginacion`, `csv`, `slug`, `imagen`, `storage` y `send-order` quedan intactas como red.

**Orden del refactor.** (1) Un PR de limpieza: restos de la v4, código muerto y comentarios. (2) Pruebas de caracterización del buscador (con temporizadores simulados), del reintento de la bolsa y de la confirmación. (3) Extraer `resumenDeCompra()` y los hooks de compra, bolsa y confirmación. (4) Partir `VistaCarrito`. (5) Lecturas por GET o RSC con caché. (6) La interfaz nueva. La estructura de carpetas objetivo está en `audit_codigo_tienda.json` (clave `estructura_objetivo`).

### 4.5 Arquitectura Next.js y rendimiento

Verificado contra la documentación incluida en `node_modules/next/dist/docs` y con un prototipo aislado en Next 16.3.2 (`next build` y `next start` con Chrome; registros en `arquitecto-next/out-proto2` a `out-proto9` y `out-cc1`).

**Media · La caché no funciona: `revalidate = 30` es letra muerta.** `src/app/page.tsx:16` y `src/app/producto/[referencia]/page.tsx:8` lo declaran, pero todas las lecturas usan un cliente que hace `await cookies()` (`src/lib/supabase/server.ts:5`) y `/` lee `searchParams`: las dos rutas se renderizan en cada visita. El build no las lista como prerenderizadas, y en producción `/`, `/?categoria=sombras` y `/producto/GLS735` responden `Cache-Control: private, no-cache, no-store` y `X-Vercel-Cache: MISS`, con TTFB de 0,26 a 0,46 s. Cada visita a `/` hace 4 consultas a Supabase más una en serie para resolver la categoría (`catalog.ts:140-151`). Los `revalidatePath` del panel no tienen efecto, y además apuntan a una ruta sin codificar mientras los parámetros llegan codificados. Impacto: en un pico de live cada clienta paga el render completo y las consultas, y se gasta el plan gratuito.

**Media · Las lecturas se hacen con Server Actions.** `cargarMasProductos` y `cargarTonos` (`src/app/acciones-catalogo.ts:18-41`) y `cargarCarrito` (`src/app/carrito/actions.ts:40-90`). Next las despacha de una en una por cliente, viajan como POST, no se cachean y su identificador cambia en cada despliegue: abrir la hoja mientras carga «Ver más» espera, y un despliegue con la bolsa abierta hace fallar el pedido en el último paso. La documentación las reserva para mutaciones (`02-guides/server-actions.md:26-30`).

**Baja · El esqueleto raíz se filtra a otras rutas.** El `loading.tsx` con forma de catálogo envuelve la bolsa, `/pedido/[id]` y el panel; en el prototipo también se pintó dentro del modal (`out-proto2`).

**Baja · Errores de borde.** `/producto/100%25` lanza `URIError` en `generateMetadata`; una referencia inexistente responde 200 en vez de 404; `busqueda` y `pagina` no tienen tope.

**Baja · Imágenes mal dimensionadas.** `sizes="25vw"` pide imágenes del doble de ancho en pantallas grandes (`TarjetaProducto.tsx:116`); hay `preload` en imágenes que no son la principal (`VisorImagen.tsx:94`); la caché de imágenes es de 4 h por defecto y Storage responde con `max-age=3600`.

**Arquitectura recomendada** (verificada en el prototipo):
1. **Ficha como vista rápida con URL propia.** Rutas interceptadas y paralelas: `src/app/@modal/(.)producto/[referencia]/page.tsx` y `src/app/@modal/default.tsx`, que devuelve `null` y es obligatorio en Next 16. La ficha completa se queda en `/producto/[referencia]` para la carga directa y los enlaces de WhatsApp. En el prototipo, el estado del catálogo y el scroll se conservaron al abrir y cerrar; Atrás cerró el modal y Adelante lo reabrió.
2. **Sin el catch-all que sugiere la documentación.** Cierra el modal al navegar, pero hace que cualquier URL inexistente responda 200. En su lugar, un guard con `usePathname()` en `ModalProducto` que no pinta el modal fuera de `/producto/*` (`out-proto7`).
3. **Esqueletos por segmento.** Mover el catálogo y su `loading.tsx` a `src/app/(tienda)/`, y dar `loading.tsx` propio al modal y a `/pedido/[id]`.
4. **Datos públicos sin cookies y con caché.** Un cliente anónimo de solo servidor, `unstable_cache` con etiquetas `catalogo` y `precios` y una versión en las claves, `cache()` de React en la ficha, y ficha y modal como ISR (`revalidate = 300` y `generateStaticParams` vacío). El panel invalida con `updateTag`; `confirmarPedido`, con `revalidateTag('catalogo', 'max')`. El stock visible puede ir hasta 5 minutos atrasado; la verdad sigue en la reconciliación de la bolsa y en `crear_pedido`, que no se cachean.
5. **«Ver más» por GET** (`/api/catalogo`, con caché corta y sin caché cuando hay texto de búsqueda). Los tonos llegan con la ficha.
6. **La bolsa sigue en el navegador**, sincronizada entre pestañas. Un solo Server Action público, `confirmarPedido`, con el correo en `after()`. `error.tsx` con `retry()`, y «Recargar» solo para cuando un despliegue deja la página vieja.
7. **No activar `cacheComponents` en este rediseño.** Funciona con el modal (se probó), pero obliga a quitar 11 exportaciones de configuración y a reacomodar varias páginas, para un beneficio pequeño con 22 pedidos.

**Riesgos del modal y cómo se cubren.** Con el modal abierto, `useSearchParams` y `usePathname` leen la URL del producto: el buscador de fondo se vacía y una búsqueda pendiente se cancela (guard en `Buscador` y `OrdenProductos`). Un doble toque en «Cerrar» ejecuta dos veces `router.back()` y saca a la clienta a TikTok o WhatsApp (un indicador que bloquea el segundo cierre). Un `notFound()` dentro del modal pinta el 404 en el hueco (mostrar «Este producto ya no está disponible» con «Cerrar»). Next 16 no mueve el foco al navegar (foco inicial, trampa de tabulación y devolución al cerrar). Regla operativa: no desplegar durante los lives.

### 4.6 Datos y backend

**Alta · La búsqueda no tolera tildes, plurales, varias palabras ni separadores.** Contra producción: «pestanas» da 0 frente a 18 con «pestañas»; «unas», 0 frente a 11; «lapiz», 0 frente a 5; «labiales», 0 frente a 29 con «labial»; «brocha polvo», 0 frente a 5 buscando palabra por palabra. `unaccent` no está instalada, y la similitud por trigramas es ruidosa aquí (desde «lavial» no encuentra «labial»). Propuesta combinada: una función SQL `normalizar()` inmutable (minúsculas y sin tildes), palabras normalizadas en TypeScript (sin palabras vacías y con singular simple) y una RPC `buscar_productos` que exige cada palabra sobre nombre, referencia, descripción, categoría y tonos, con 11 ms medidos sobre los 372 productos. A esa RPC le falta lo que señaló la crítica: comparar también la referencia sin separadores en los dos lados, porque «usk621» no aparece dentro de «usk-621». Y una tabla corta de sinónimos: brillo y gloss; rímel, máscara y pestañina; rubor y blush; neceser y cosmetiquera.

**Alta · `cancelar_pedido` devuelve menos stock cuando un pedido trae varios tonos del mismo producto.** La función (`supabase/functions.sql:164`) actualiza `products` desde `order_items`: si un producto coincide con varias líneas, PostgreSQL aplica solo una. 4 de los 22 pedidos tienen el mismo producto en 2 a 4 líneas (12 unidades), y las pruebas solo cancelan pedidos de una línea (`tests-v4.sql:214-232`). Además, un pedido cancelado se puede volver a abrir sin descontar otra vez (`TablaPedidos.tsx:126`, `acciones-pedidos.ts:31`). Impacto: agotados falsos o sobreventa, justo en la acción que más conviene que la dueña use. Propuesta: sumar por producto antes de actualizar, una RPC que solo permita transiciones válidas (de nuevo a pagado y a enviado; de nuevo o pagado a cancelado, que es final) y una prueba con dos tonos.

**Media · Un solo pedido puede apartar todo el inventario.** `confirmarPedido` solo exige que haya ítems (`src/app/carrito/actions.ts:208-210`) y `crear_pedido` no tiene tope de líneas ni de cantidades (`migracion-v4.sql:204-237`). El inventario activo suma 17.947 unidades, unos $347 millones a precio de 1 unidad. El único freno son 6 pedidos cada 10 minutos por IP. La clave de idempotencia se consulta sin bloqueo (`:162-176`) y los productos se bloquean en el orden de la bolsa, con riesgo de interbloqueo. El pedido real más grande tuvo 11 líneas y 11 unidades. Propuesta: topes de 40 líneas, 50 unidades por línea y 150 en total (por encima, WhatsApp), validar tono y largos, bloquear en orden de id y registrar cada rechazo por límite para saber si afecta a clientas que comparten IP.

**Media · Ordenar por precio no coincide con el precio que se ve.** «Menor precio» ordena por el escalón más barato (`catalog.ts:163-169`) y la tarjeta muestra el de 1 unidad (`TarjetaProducto.tsx:74-76`): hay 91 saltos en el orden ascendente. Propuesta: ordenar por lo que se muestra.

**Media · Las subcategorías existen en el esquema y en la interfaz, pero no en la consulta.** `obtenerProductos` filtra con `.eq('category_id', …)` (`catalog.ts:158`), así que «Todo en {grupo}» daría 0 productos. `guardarCategoria` permite que una categoría sea su propia madre o que haya tres niveles, y regenera el slug al renombrar, lo que rompe los enlaces compartidos. Propuesta: filtrar por la categoría y sus hijas con la lista que ya se carga, máximo dos niveles en SQL y slugs estables.

**Media · Fotos pequeñas y apaisadas, recortadas por la grilla.** De 40 fotos medidas, 36 tienen menos de 600 px de ancho (lo típico, unos 470×380) y 37 no son cuadradas (`datos-auditor/dims40.txt`). El bucket tiene 643 archivos: 630 JPEG con mediana de 30 KB y 13 PNG con media de 513 KB. Propuesta: `object-contain` sobre fondo neutro ya; normalizar al subir (lienzo cuadrado sin recortar, WebP y caché de un año) y reprocesar una vez las 643. Eso no gana resolución: para la ficha hace falta mejor material.

**Media · 145 productos comparten nombre con otro.** Son 51 nombres repetidos; «Set de brochas profesionales» aparece 9 veces con 5 precios distintos, y hay variantes con errata («caiman paraa el cabello»). La auditoría de experiencia, con otro criterio, contó 94. En la grilla parecen duplicados. Propuesta: un campo corto `variante`, depurar nombres y fusionar los repetidos en un producto con modelos.

**Media · Los scripts de prueba escriben en producción.** `scripts/probar-flujo.mjs`, `probar-descuentos.mjs` y `probar-e2e-correo.mjs` crean y borran productos y pedidos en la base real, y el último envía un correo real. Por eso la numeración llega a AB-0097 con solo 22 pedidos. Propuesta: probar contra una rama de Supabase o una base local durante el rediseño.

**Factibilidad de lo nuevo.**
- «Del mismo tipo» en la ficha: sale de los datos actuales.
- «Novedades»: necesita una fecha de publicación, porque 326 de los 372 productos se crearon el mismo día.
- «Más vendidos»: todavía no hay datos (45 productos vendidos, máximo 9 unidades); empezar con un «destacado» elegido a mano.
- «En el live ahora»: un campo o una tabla con orden, no una categoría.
- Muestras de color en la grilla: cuestan poco (2,6 ms para 24 productos), pero la sección 4.3 desaconseja mostrarlas.

### 4.7 Seguridad

**Crítica · Registro abierto y políticas que tratan a cualquier sesión como administradora.** `GET /auth/v1/settings` devuelve `disable_signup: false`. Todas las políticas `*_admin` son `for all to authenticated using (true) with check (true)` (`supabase/policies.sql:44-70`, `migracion-v2.sql:75-86`; confirmado en `pg_policies`). El panel solo comprueba que haya un usuario, no su rol (`src/proxy.ts:24-36`, `acciones-pedidos.ts:13-20`, `productos/actions.ts:27-31` y `:196-199`). `supabase/README.md:59-60` y `Funcionalidades.md:344-346` pedían desactivar el registro y no se hizo. Hoy hay 2 cuentas y ninguna señal de abuso; la protección de contraseñas filtradas está apagada. Impacto: una cuenta nueva confirmada podría leer nombre, WhatsApp y ciudad de todas las clientas; cambiar la cuenta y el titular de pago que se muestran en `/pedido`, en la bolsa y en el recibo, y así desviar pagos; cambiar precios y stock; y cancelar pedidos. Lo único que lo frena es la confirmación por correo, y solo mientras el proyecto use el SMTP por defecto de Supabase. Qué hacer: hoy, desactivar el registro y activar la protección (sección 6); después, un rol explícito de administradora en las políticas, el proxy y las acciones (una tabla `administradores` con `es_admin()`, o `app_metadata.rol`: hay que elegir una), y que `scripts/verificar-migracion.mjs` falle si el registro está abierto.

**Alta · La clave de diagnóstico está publicada en un repositorio público.** `SETUP.md:213` trae la cabecera con la clave literal, y es la misma que usa el entorno. Con ella, `/api/diagnostico` siempre envía un correo de prueba (`src/app/api/diagnostico/route.ts:65-79`) y con `?correo=1` otro (`:97-114`); compara con `!==` y no limita intentos (`:28`). El plan gratuito de Resend da 100 correos al día (`Funcionalidades.md:468`). Impacto: unas 50 llamadas dejan a la dueña sin avisos de pedido en pleno live; la ruta además muestra el correo de destino, la URL de Supabase, el conteo de productos y huellas de las claves. Qué hacer: rotar la clave en Vercel (borrarla del archivo no basta, porque queda en el historial), dejar un marcador en `SETUP.md`, comparar con `crypto.timingSafeEqual` y no enviar correos salvo con `?correo=1`.

**Alta · Realtime está apagado.** La publicación `supabase_realtime` tiene 0 tablas, y `TablaPedidos.tsx:33-48` se suscribe a `orders` sin revisar el estado de la conexión, así que falla en silencio. `supabase/README.md:49-52` y `Funcionalidades.md:352-354` lo dan por activo. Impacto: durante un live el panel no muestra pedidos nuevos hasta recargar; si además falla el correo, la dueña no se entera. Qué hacer: una migración que agregue `orders` a la publicación, aplicada después de cerrar el registro (Realtime entrega los cambios a cualquier sesión que pase las políticas), con un indicador «En vivo / Reconectando» en el panel.

**Alta · Dos importadores borran datos si se usan como dice la documentación.** Reejecutar `scripts/cargar-catalogo-engol.mjs` (`:293-303`) ocultaría 324 de los 372 productos activos y les pondría stock 0 y descripción vacía, sin historial para recuperar el stock; `Funcionalidades.md:674-675` dice que es seguro reejecutarlo. El importador CSV del panel (`src/app/admin/(panel)/importar/actions.ts:48-57`; `csv.ts:43-47` y `:93`) pone stock 0 cuando la columna viene vacía, borra categoría y descripción y publica borradores: hay 261 productos ocultos o en borrador, 225 de ellos con precio. Qué hacer: en el script, insertar solo referencias nuevas; en el CSV, actualizar solo las columnas con valor, no tocar la visibilidad y mostrar las diferencias antes de confirmar.

**Media · Un pedido puede vaciar el inventario.** Ver 4.6. El identificador de la acción está en el código que descarga el navegador, así que cualquiera puede llamarla.

**Baja · Superficie menor.** `next.config.ts:5-11` acepta `*.supabase.co`, así que cualquier proyecto de Supabase puede usar el optimizador de imágenes de esta web. `guardarConfiguracion` guarda cualquier clave que llegue en el formulario (`configuracion/actions.ts:18-25`). El asesor de Supabase marca que `rls_auto_enable()` se puede ejecutar como anónimo y que `code_attempts` tiene RLS sin políticas. Los datos del panel se leen con `service_role` y solo los protege el proxy (`admin-catalog.ts`, `orders.ts:93-121`).

**Orden de cierre.** (1) Registro y contraseñas filtradas. (2) Rotar la clave. (3) Rol de administradora. (4) Realtime de `orders`. (5) Importadores. (6) Topes en `crear_pedido`.

### 4.8 Panel de administración

El auditor no pudo iniciar sesión: revisó el código, consultó la base en modo lectura y renderizó maquetas con el CSS real (`auditor-admin/capturas/01-maqueta-pedidos.png` a `03-maqueta-recibo.png`). Ya descritos: registro abierto (crítica, 4.7), Realtime apagado (alta, 4.7), importador CSV (alta, 4.7) y `cancelar_pedido` (alta, 4.6).

**Alta · Las fotos de más de 1 MB no suben y el panel culpa al internet.** Un Server Action acepta 1 MB por defecto y `next.config.ts` no lo cambia, pero `src/lib/imagen.ts:10` promete 5 MB y `FormularioProducto.tsx:64-67` muestra «Revisa tu internet». De 67 archivos subidos desde el panel, ninguno pasa de 926.799 bytes; una foto de la cámara del celular pesa de 2 a 6 MB. Hay 36 archivos huérfanos en el bucket. Hay tres salidas propuestas y son incompatibles: comprimir en el navegador y subir directo a Storage con una URL firmada (panel); normalizar con sharp dentro de la acción (datos), que sigue chocando con el tope de 1 MB; o subir el tope a 6 MB (Next.js). Hay que elegir una; la primera es la única que no hace pasar el archivo por el servidor, y sharp sirve igual para reprocesar una vez las fotos existentes.

**Media · Atender un pedido cuesta 3 toques y los estados no se usan.** Hay que abrir la tarjeta para actuar, y «Marcar pagado», «enviado» y «cancelado» pesan igual (`TablaPedidos.tsx:62-163`). «Escribirle» abre WhatsApp sin mensaje; la nota interna existe en la base pero no tiene interfaz; para sacar el recibo hay que ir a Recibos y buscar el pedido en una lista con todos (`ConstructorRecibo.tsx:267-283`); el correo de aviso enlaza al panel en general (`order-template.ts:125`). Resultado: 21 de 22 pedidos siguen en «nuevo». Propuesta: el siguiente paso visible en la tarjeta («Confirmar pago», «Marcar enviado»), «Cancelar» aparte y en color de peligro, mensajes de cobro y envío ya escritos, botón de recibo por pedido y filtro «Por cobrar hace más de 48 h».

**Media · El resumen del día se calcula en UTC y sobre la lista filtrada.** `src/app/admin/(panel)/page.tsx:34-41` usa la fecha del servidor, que en Vercel está en UTC: «hoy» cambia a las 7 p. m. de Colombia, en plena franja de lives. Suma sobre la lista ya filtrada y con tope de 200 (`orders.ts:103`): al filtrar «enviado», «Sin confirmar pago» queda en $0. La hora se formatea sin zona horaria (`TablaPedidos.tsx:75-78`) y produce un error de hidratación. Propuesta: indicadores calculados en SQL con `America/Bogota`, sin depender del filtro.

**Media · Errores y cargas del panel usan las pantallas de la tienda.** No hay `loading.tsx` ni `error.tsx` en `src/app/admin`: el panel muestra el esqueleto del catálogo y, ante un fallo, le dice a la administradora «Tu pedido sigue guardado en tu bolsa». `cambiarEstadoPedido` y `guardarConfiguracion` lanzan excepciones sin captura; las acciones de categorías y descuentos ignoran el error; ningún formulario confirma que guardó; hay 4 formas distintas de devolver errores. Propuesta: carga y error propios del panel, un solo contrato de resultado y un aviso de «Guardado».

**Media · En el celular la navegación esconde 4 de las 7 secciones.** El menú tiene 245 px para 568 px de enlaces (`src/app/admin/(panel)/layout.tsx:4-37`): Descuentos, Recibos, Ajustes y QR quedan fuera de la pantalla y nada marca la sección activa. Propuesta: barra inferior con Pedidos (con contador de nuevos), Productos, Recibos y Más.

**Media · Productos: 633 en una sola lista, borrar a un toque y el guardado devuelve al inicio.** `productos/page.tsx:18` trae los 633 productos con 1.999 tonos y 1.592 escalones que la lista no usa; no hay filtros, y los 261 ocultos o borradores se mezclan con los 372 activos. La papelera de cada fila borra de verdad (`productos/actions.ts:210`), aunque `Funcionalidades.md:421` dice que nunca se borran productos. Cambiar solo el stock exige abrir el formulario completo. Propuesta: filtros por estado y categoría, «Ocultar/Mostrar» y stock ± en la fila, y «Eliminar» solo dentro de la ficha.

**Media · `guardarProducto` escribe por partes y valida después.** Crea el producto y reemplaza los escalones antes de validar los tonos (`productos/actions.ts:110-152`): un producto nuevo con dos tonos del mismo nombre queda publicado sin tonos y se puede comprar sin elegir; al reintentar, dice que la referencia ya existe. Cada guardado cambia los id de los tonos, y eso duplica líneas en bolsas guardadas.

**Media · El editor de tonos no sirve para 36 tonos desde el celular.** Dos filas por tono (72 para PCL-885), sin carga en lote, sin reordenar y sin «agotado» (`FormularioProducto.tsx:290-333`); 745 de los 1.999 tonos del panel se llaman «Tono N». Propuesta: la herramienta «leyenda de la foto» (4.3), con una opción «Pegar lista».

**Media · Las categorías y el orden del catálogo no se pueden administrar.** `categorias/page.tsx:25-47` solo crea y oculta: no renombra, no reordena, no asigna madre a las existentes ni reactiva. Las 8 categorías ocultas desaparecen del panel y 26 borradores están en ellas. El orden «Los que recomendamos» usa un campo que el panel no deja cambiar: los 46 productos activos con orden 0 salen primero. El rediseño necesita ambas cosas para agrupar categorías y destacar productos en el live.

**Media · Ajustes que no hacen nada y restos del código de acceso.** «WhatsApp del negocio» se guarda pero la tienda usa una constante. Siguen el campo «Horas que dura un código» (`configuracion/page.tsx:29-33`), el texto «usa el código de acceso normal» (`recibos/page.tsx:31`) y el join a `access_codes`.

**Media · El recibo en PDF puede rotular mal el descuento.** `ConstructorRecibo.tsx` (579 líneas, 18 estados) repite la cuenta de totales en 4 sitios. Si se edita un precio, el PDF dice «Descuento 5%» con un monto que no es el 5 % del subtotal impreso (`:205`, `:225`), y muestra «Precio por mayor (base)» como resta aunque ya está incluido (`:533-540`). Los campos miden 22 px de alto. Propuesta: un cálculo compartido y compartir el PDF a WhatsApp con un toque.

**Baja · El proxy consulta a Supabase en cada petición del panel**, también en las precargas de enlaces (`proxy.ts:24-26`); conviene una comprobación ligera ahí y la validación del rol cerca de los datos.

**Baja · El QR es rosa vivo** (`GeneradorQR.tsx:17`), con menos contraste en un video comprimido, y no lleva un parámetro de origen para medir.

### 4.9 Negocio y cumplimiento

Investigación sobre el flujo previsto (specs v1 y v2, plan, `Funcionalidades.md`, `SETUP.md`) y los 22 pedidos de producción. Las cifras salen de consultas SELECT agregadas sobre `orders`, `order_items`, `access_codes` y `store_settings`, sin datos personales.

**Alta · Nadie decidió qué pasó con los $10.000 de «abrir bolsa».** Según la spec v1 (`docs/superpowers/specs/2026-08-22-anaya-beauty-catalogo-design.md:8-14`), la clienta transfería $10.000 y la dueña, tras verificarlos, le enviaba un código de 4 dígitos para confirmar el pedido: era el filtro contra pedidos falsos. Ningún documento dice si se descuentan del total, si son el envío o un cargo aparte, y nada en la base los registra: `orders` no tiene columna de abono (`migracion-v4.sql:44-46`), `store_settings` tiene 7 claves sin abono ni envío y ninguno de los 20 códigos generados tiene nota. La v4 quitó el código y con él el filtro. El banner es de ese flujo anterior (commit a64b95a, 27-ago) y sigue pidiéndolos, mientras el resto de la web dice «confírmalo en un minuto», «sin cupones ni códigos» y «aquí no se cobra nada» (`Encabezado.tsx:29-31`, `CintaBeneficios.tsx:39`, `VistaCarrito.tsx:622-625`). `SETUP.md:200-203` dice «Igual que antes», y es falso: antes no se podía pedir sin pagar. Impacto: la primera pantalla da dos instrucciones incompatibles; la clienta puede pagar $10.000 que nadie le acredita, pagar de más o no pedir, y si la dueña los sigue cobrando por WhatsApp no hay forma de ligar ese pago al pedido. Qué hacer: no borrar el texto a ciegas, porque es lo único público que queda de una regla comercial; lo decide la dueña (sección 6).

**Alta · El envío no tiene precio, plazo ni dirección, pero la web pide transferir el total.** La bolsa dice «Total a pagar» (`VistaCarrito.tsx:674`) y `/pedido`, «Transfiere $total» (`src/app/pedido/[id]/page.tsx:75-77`). Los textos dan el envío por hecho («¿A quién le enviamos?», «te confirmamos el pago y el envío», «Despachamos y te avisamos»), pero solo se pide la ciudad (`src/app/carrito/actions.ts:206`) y ningún ajuste habla de envío; las specs lo dejaron fuera de alcance (v1:265-271, v2:132-135). Hay 4 ciudades y 18 de los 22 pedidos son de una sola. Impacto: la clienta transfiere un total que no es el final y después le piden un segundo pago, y la Ley 1480 exige el envío por separado y la suma total antes de confirmar. Qué hacer: con la tarifa que dé la dueña, una línea «Envío» en el resumen de la bolsa y de `/pedido`; si se cotiza después, «Lo cotizamos antes de que pagues» y rotular «Total productos» mientras tanto; pedir modalidad y dirección; mostrar el plazo.

**Media · Faltan los datos y avisos que exigen la venta a distancia y el tratamiento de datos.** Pedir por la web ya es comercio electrónico aunque el pago sea manual (Ley 1480, art. 49). Verificado en el texto consolidado de `alcaldiabogota.gov.co`; no reemplaza la revisión de un abogado.

| Requisito | Norma | Hoy |
|---|---|---|
| Identidad del vendedor: nombre o razón social, NIT, dirección de notificación judicial, teléfono y correo | Ley 1480, art. 50 a; art. 46 num. 3 | Solo la marca y el WhatsApp (`src/app/page.tsx:103-105`); el titular del pago sale enmascarado |
| Precio total con impuestos, y los gastos de envío por separado | Art. 50 c | Un total sin envío |
| Resumen antes de confirmar con el envío y la suma total | Art. 50 d | No existe |
| Derecho de retracto y tiempo de entrega, antes de comprar | Art. 46 num. 4; art. 47 (5 días hábiles) | No aparecen. La excepción de bienes de uso personal (art. 47 num. 7) probablemente cubre el maquillaje, pero hay que informarla y validarla con un abogado |
| Acuse de recibo a más tardar el día siguiente, con envío y forma de pago | Art. 50 d | `/pedido` no muestra envío ni plazo, y el correo del pedido solo le llega a la dueña (`send-order.ts:36-41`) |
| Plazo máximo si no se pacta: 30 días calendario | Art. 50 h | No se informa |
| Enlace visible a la SIC | Art. 50, parágrafo | No existe |
| Autorización previa, expresa e informada, sin excepción por ejecutar la venta | Ley 1581, arts. 4 c, 9 y 10 | No se pide |
| Informar finalidad, derechos y responsable | Ley 1581, art. 12 | Una frase: «Solo lo necesario para despachar tu pedido» (`VistaCarrito.tsx:546`) |
| Pedir la autorización a más tardar al recolectar los datos; el silencio no vale | Decreto 1074 de 2015, arts. 2.2.2.25.2.2 y 2.2.2.25.2.4 | No se pide |
| Conservar prueba de la autorización | Art. 2.2.2.25.2.5 | `orders` no tiene dónde guardarla |
| Política de tratamiento o aviso de privacidad | Arts. 2.2.2.25.3.1 y 2.2.2.25.3.3 | No existe |

**Media · El cálculo por pedido parte lo que la dueña trata como una sola bolsa.** En las dos repeticiones reales de una misma noche, la dueña generó el segundo código 42 s y 1,7 min después del primer pedido: para ella la bolsa seguía abierta. Escalones, precio por mayor y 5 % se calculan por pedido (`migracion-v4.sql:204-305`), así que AB-0063 ($19.000) y AB-0064 ($28.000) quedaron sin el 5 %. Con los precios de hoy, juntar los pedidos de una misma clienta ahorraría entre $950 y $2.150; juntar las dos parejas de números activaría el precio por mayor, cerca de un 20 % (entre $53.675 y $56.240 cada una). Es una decisión de precio, no de diseño. Al confirmar, la bolsa se vacía y el celular no guarda ni el pedido ni los datos (`VistaCarrito.tsx:106`).

**Media · Hay indicios de que alguien llena pedidos por otras personas.** Una sola cuenta generó los 20 códigos, y en 8 de 17 pedidos el código se usó 30 s o menos después de generarse, algo casi imposible si había que enviárselo por WhatsApp a otra persona. 6 de los 17 pedidos reales llegaron en parejas de dos números con 2 a 6 minutos de diferencia, y la última pareja salió de la misma IP. `SETUP.md:226-229` ya prevé «una tienda comprando para varias personas» y aconseja tomar ese pedido por WhatsApp, es decir, fuera del sistema: no descuenta stock ni aparece en el panel. Es una inferencia; la confirma la dueña.

**Media · Los estados del pedido no se usan.** 21 de 22 pedidos siguen en «nuevo», en promedio desde hace 62 días; hay 0 pagados, 0 cancelados y 0 notas internas. El único cambio de estado de la tabla es AB-0009, una prueba, que pasó a «enviado» 7 minutos después de crearse. «Sin confirmar pago» suma $1.208.830 y hay 78 unidades apartadas de 43 productos; solo cancelar devuelve el stock (`functions.sql:164-193`). La dueña sí entra al panel: hay sesiones hasta el 8-nov y editó 103 productos la semana del 26-oct. Impacto: sin el filtro de los $10.000, un pedido falso aparta stock para siempre, y cualquier forma de juntar pedidos necesita saber qué está pagado para no cobrar dos veces.

**Media · La línea base «17 antes contra 5 después» está inflada por pruebas.** AB-0009, AB-0010, AB-0011, AB-0012 y AB-0019 llevan el mismo nombre completo con 3 números distintos, y el primer código se generó a las 22:04 del 22-ago, dos minutos después del commit de despliegue d4c84e4. Sin ellos quedan 12 pedidos en 19 días antes de la v4 (0,63 por día, en 4 fechas y 5 tandas) contra 5 en 61 días después (0,08 por día): una caída del 87 % por día. Antes de la v4, 15 de 17 pedidos llegaron entre las 18:00 y las 24:00; después, 4 de 5 fueron de día. No hay analítica (`package.json`) y `orders` no guarda el origen, así que la caída no se puede atribuir a la v4: coincide con el fin de las tandas nocturnas.

**Opciones para los pedidos repetidos.**

| Opción | Qué es | Costo | Riesgo | Recomendación |
|---|---|---|---|---|
| (a) Recordar los datos en el celular | Nombre, WhatsApp, ciudad y último pedido, de forma opcional; el siguiente pedido sale como «Adicional a AB-xxxx» sin tocar precios | S: horas a un día | Bajo: celulares compartidos y navegadores de TikTok y WhatsApp con almacenamiento propio; exige aviso de privacidad | Primera iteración; cubre a las 4 clientas que volvieron |
| (b) «Agregar a mi pedido AB-xxxx» | Una función que anexa líneas, recalcula escalones y descuento y maneja stock, idempotencia y correo | L: 4 a 6 días más pruebas SQL | Alto: interbloqueos, doble pago y el enlace como única llave | Aplazar: 2 casos en 2,5 meses, ninguno desde la v4 |
| (c) Bolsa abierta hasta que termine el live | Todo lo de (b) más un live con inicio y fin, cierre, vencimiento y un solo pago | L a XL | Alto; depende de que la dueña opere el panel y de que haya lives | Decidir con las respuestas de la dueña |
| (d1) Unir pedidos desde el panel | Mover líneas y marcar los absorbidos como «unido» | M: 2 a 3 días; S a M sin recalcular | Medio; recalcular es una decisión de precio | Solo sin recálculo |
| (d2) Crear un pedido a nombre de una clienta desde el panel | Reutiliza el modo manual de recibos, sin límite por IP y con origen «panel» | M: unos 2 días | Bajo | Si la dueña o una ayudante llenan pedidos |

**Primera iteración recomendada.** (1) Con las respuestas de la dueña, reemplazar el mensaje del banner y crear un mismo «Resumen de pago» en la bolsa y en `/pedido`: productos, descuentos, envío (valor o «se cotiza antes de pagar»), plazo, abono si existe y total a transferir (S). (2) Bloque legal: identidad, retracto, garantía, condiciones, enlace a la SIC, aviso de privacidad con prueba de la autorización y el enlace de `/pedido` dentro del mensaje de WhatsApp (S). (3) Opción (a) con «Adicional a AB-xxxx» (S). (4) Opción (d2) si la dueña llena pedidos (M). (5) Parámetro de origen en el QR (S).

---

## 5. Decisiones del rediseño

Esta sección la completa el equipo de implementación al cerrar el rediseño.

---

## 6. Tareas que solo puede hacer la dueña o el dueño

Estas tareas no se pueden automatizar sin su criterio o sin sus accesos. Las tres primeras son de esta semana.

### 6.1 Seguridad

1. **Cerrar el registro.** En Supabase, Authentication: desactivar «Allow new users to sign up» y activar la protección de contraseñas filtradas. Toma minutos. Después, el equipo agrega el rol de administradora en las políticas, el proxy y las acciones.
2. **Rotar la clave de diagnóstico.** Generar una `CLAVE_DIAGNOSTICO` nueva en Vercel y reemplazar la actual. Borrarla de `SETUP.md` no basta: la publicada queda en el historial del repositorio público.
3. **Avisar las fechas de los lives.** No se despliega durante un live: un despliegue con bolsas abiertas hace fallar la confirmación.

### 6.2 Decisiones de negocio que cambian el diseño

| Pregunta | Según la respuesta |
|---|---|
| ¿Siguen los $10.000 de «abrir bolsa»? | **Sí:** escribir la regla en la web (qué son, cuándo se pagan, cómo se descuentan) y registrar el pago en el pedido (M). **No:** quitar el texto del banner ya, avisar a las clientas habituales y corregir `SETUP.md:9-11` y `:200-203`; el filtro contra pedidos falsos pasa a ser el vencimiento de pedidos sin pago |
| Si siguen, ¿qué son? | **Abono que se descuenta:** `/pedido` muestra «Saldo = total − $10.000». **Son el envío:** pasan a ser la línea «Envío» del total y «abrir bolsa» desaparece. **Cargo aparte:** se suma al total antes de confirmar y deja de valer «aquí no se cobra nada» |
| ¿Cuánto cuesta el envío y cuánto tarda? | **Tarifa fija:** dos ajustes (local y nacional), una línea fija en el resumen y la ciudad como selector. **Variable:** «Lo cotizamos antes de que pagues», sin pedir la transferencia hasta tener el valor. **Plazo:** mostrarlo; si no se pacta, rige el máximo de 30 días. **Domicilio, recogida o contraentrega:** el formulario pide modalidad y dirección |
| ¿Sigue habiendo lives? ¿Por dónde llegan los pedidos desde septiembre? | **Hay lives:** prioridad a «En el live ahora», recordar datos y pedido adicional, medidos con el origen del QR. **Llegan por WhatsApp o enlaces:** prioridad a navegar y compartir productos; las opciones (b) y (c) no tendrían uso |
| ¿Quién llena los pedidos? | **Ella o una ayudante:** «Crear pedido» desde el panel (d2). **Revendedoras:** «Es para otra persona» y una regla de si el precio por mayor va por pagadora. **Cada clienta:** basta con recordar los datos (a) |
| ¿El 5 % y el precio por mayor van por pedido, por clienta y noche, o por bolsa conjunta? | **Por pedido:** decirlo en la web. **Por clienta y noche:** recalcular al vincular, entre $950 y $2.150 por caso. **Por bolsa conjunta:** las dos parejas habrían pagado cerca de un 20 % menos; es una decisión de margen |
| ¿Se acumulan en una sola bolsa las compras de varios lives? | **Sí:** opción (c), con fecha de cierre, un solo pago, un solo envío y vencimiento del stock apartado. **No:** pedidos independientes, con «Adicional a AB-xxxx» para empacar junto lo de la misma noche |
| ¿Se marca «agotado» por tono? | **Sí (recomendado):** una bandera por tono, sin inventario por tono. Reabre a propósito la decisión de la spec v2, que llevó el stock por producto (`docs/superpowers/specs/2026-08-23-anaya-beauty-v2-design.md:28-35`). **No:** se sigue borrando tonos, y eso renumera la foto |
| ¿Qué grupos de categorías? | Elegir entre las tres propuestas de la sección 4.1 (7 u 8 grupos) |
| ¿Qué topes por pedido? | Propuesta: 40 líneas, 50 unidades por línea y 150 en total; por encima, por WhatsApp. Ajustarlos a los pedidos al por mayor reales |

### 6.3 Identidad legal y datos personales

- Nombre o razón social, NIT o RUT, dirección de notificación judicial, teléfono y correo, para el pie de la tienda y el resumen de pago (Ley 1480, art. 50 a).
- Textos de retracto (5 días hábiles), garantía y condiciones, validados por un abogado, en especial la excepción de bienes de uso personal (art. 47 num. 7).
- Política de tratamiento de datos y aviso corto: quién es la responsable, para qué se usan los datos, qué derechos tiene la clienta y por dónde los ejerce (Ley 1581; Decreto 1074 de 2015, art. 2.2.2.25.3.1).
- Decidir si se ofrece «Recordar mis datos en este celular»: si sí, el aviso debe decirlo.

### 6.4 Limpieza de tonos y fotos

La guía visual es la hoja de contacto con 12 casos reales y la regla de cada uno: `C:\Users\Brayan\AppData\Local\Temp\claude\c4f901e614d65603\4f5f8714-b889-4714-9ae0-ed67ee592183\scratchpad\tonos-leyenda\salida\hoja-contacto-tonos.png` (también en `.html`). La clasificación completa de los 244 productos está en `tonos-leyenda/datos/clase_todos.json`.

| Tarea | Cuántos | ¿Se puede hoy desde el editor? |
|---|---|---|
| Renombrar los «Tono N» de accesorios al color visible, en el orden de la foto | 47 productos, 193 filas | Sí |
| Copiar lo impreso tal cual (NO.2IN1, LPZ-80, WEEK-7) | 3 productos | Sí |
| Acortar o separar nombres casi iguales (FLO-2 ×4, PCF-33, MIR-892) | Unos 6 productos | Sí |
| Reordenar según la foto (LPL-279, STYLE444) y renumerar PCL-989-3 | 3 productos | No: el editor no reordena |
| Corregir, o dejar de mostrar, colores que no salen de la foto | 200 filas en 84 productos, más 7 mal tomados (HWI-362, HWIP-26, POS-739, PCL-885, LUX-121, MT-779, LAS-944) | Solo a mano, sin gotero |
| Dejar de vender tonos con sello AGOTADO | PC908 «Tono 7» y GE-7208 «Gema C» | Sí, pero borrar renumera: mejor con la bandera de agotado |
| Revisar productos que quedaron con un solo tono | 5 (KC7002, BAO-643, SOM-899, ER-30P, PX123) | Sí |
| Corregir descripciones que anuncian más tonos de los que hay | 13 (PE3D, KC7002, BAO-643, F07, entre otros) | Sí |
| Rehacer o recortar fotos incoherentes | 33 (16 con AGOTADO y 17 con variantes que sobran o faltan) | Subir otra foto, sí |
| Segunda ola: fotos de maquillaje con posición ambigua, si no se hacen las marcas sobre la foto | 22 | — |

En maquillaje, los «Tono N» de una fila o ambiguos (46 productos, 268 filas) **no** se renombran: son la clave que llega en el pedido. Los renombres conviene hacerlos después de que el editor guarde los tonos por id, porque las bolsas guardadas conservan el nombre viejo. No hay que partir ningún producto si existe el segundo eje; sin él, habría que partir 13. Pauta para fotos nuevas: cuadradas, fondo blanco liso, producto centrado al 80 %, sin collage, textos ni logos del proveedor; la mejora con IA solo para limpiar el fondo, nunca para tocar el color de un tono.

### 6.5 Pedidos

- **Confirmar los pedidos de prueba** AB-0009, AB-0010, AB-0011, AB-0012 y AB-0019, y marcarlos para excluirlos de las métricas.
- **Revisar AB-0097** (10-nov, 20:42 hora de Colombia). No aparece en ningún registro de pruebas y parece de una clienta real. Pidió «PRF-IL Tono 2», que según cómo se cuente la foto es el frasco azul o el transparente: hay que confirmarle cuál quiso.
- **Usar los estados del pedido:** «pagado» al recibir la transferencia, «enviado» al despachar y cancelar los que no se pagan. Hoy 21 de 22 siguen en «nuevo», con 78 unidades apartadas y $1.208.830 sin confirmar pago; solo cancelar devuelve el stock. Definir en cuántas horas vence un pedido sin pago y si se avisa antes.

### 6.6 Material de marca

- Logotipo vectorial (SVG) de «Anaya» y «BEAUTY», sin círculo, corona, mariposa ni ramas, para la barra de 56 px; el círculo completo queda para redes.
- Si el banner sigue en redes, rehacerlo sin la instrucción del código y sin la errata, según lo que se decida de los $10.000.

---

## 7. Qué medir después del rediseño

La línea base excluye los 5 pedidos de prueba. «Antes» es del 22-ago al 9-sep (19 días); «después», del 10-sep al 10-nov (61 días).

| Métrica | Línea base corregida | Cómo medirla | Señal de mejora |
|---|---|---|---|
| Pedidos por semana | 4,4 antes de la v4 (12 en 19 días); 0,6 después (5 en 61 días) | `orders` sin pruebas, por semana y por origen | Sube, y se sabe de dónde viene |
| Pedidos que llegan desde el live | Sin dato: `orders` no guarda el origen | Parámetro de origen en el QR (`?o=live-AAAAMMDD`) que viaje con el pedido | Hay dato desde el primer live |
| Unidades por pedido (mediana) | 4,5 antes de la v4 (4 líneas); 2 después (2 líneas) | `order_items` | Sube |
| Pedidos con 3 o más unidades de un mismo producto | 4 de 17 (24 %): AB-0020, AB-0043, AB-0061 y AB-0064; 3 cobrados con precio por cantidad | `order_items` agrupado por pedido y producto | Sube: la clienta entiende que los tonos suman |
| Líneas de 1 unidad | 51 de 56 pares pedido-producto (91 %) | Ídem | Baja |
| Pedidos que llegan al 5 % (desde $50.000) | 10 de 17 (59 %); después de la v4, 1 de 5 | `orders.total` | Sube |
| Pedidos con precio por mayor | 0 de 17; el más grande quedó a $8.000 | `orders` | Aparecen |
| Clientas que repiten | 4 de 12 | WhatsApp normalizado | Sube |
| Búsquedas sin resultado | Sin dato de uso real. En prueba: «usk621», «lg 169», «gls 735», «GLS-735», «pestanina», «rimel», «labiales» y «brocha polvo» dan 0 | Evento agregado de búsqueda sin resultados, más un juego fijo de consultas como prueba automática | El juego fijo encuentra el 100 % y el porcentaje real baja |
| Uso de la búsqueda | Sin dato | Evento agregado: búsquedas y toques en un resultado | Se conoce, y crece en noches de live |
| Tonos ambiguos en los pedidos | 23 de 40 líneas reales con tono (58 %) son «Tono N»; AB-0097 pidió uno ambiguo | Conteo semanal de la dueña de aclaraciones por WhatsApp, o una casilla «tono confirmado» en el panel | Baja |
| Estado de los pedidos | 21 de 22 en «nuevo», 62 días en promedio; 78 unidades y $1.208.830 sin confirmar pago | Panel | Pagados y enviados al día; nada en «nuevo» más allá del plazo de vencimiento |
| Caché y velocidad | `MISS` y `no-store` en `/` y `/producto`; TTFB de 0,26 a 0,46 s; 4 o 5 consultas por visita | Cabeceras de producción y registros de Supabase | `HIT` en ficha y modal y menos consultas por visita |
| Franja horaria de los pedidos | 15 de 17 entre 18:00 y 24:00 antes de la v4; 4 de 5 de día después | `orders.created_at` en hora de Colombia | Dice si los lives siguen |

**Para que estas cifras signifiquen algo:**
1. Marcar los pedidos de prueba y dejar de correr scripts contra producción (4.6).
2. Poner el parámetro de origen en el QR y en los enlaces compartidos, y guardarlo con el pedido.
3. Contar eventos agregados, sin datos personales: búsqueda, búsqueda sin resultados, abrir ficha, agregar a la bolsa y confirmar. Mencionarlo en el aviso de privacidad.
4. Medir al menos 4 semanas antes de comparar, separar las noches de live y comparar contra esta base corregida, no contra «17 antes y 5 después».
5. Como no hubo pruebas con clientas, ver a 3 o 4 clientas habituales hacer un pedido en la versión nueva antes del primer live. La queja es de experiencia, y ninguna métrica la reemplaza.

---

## 8. Anexo: fuentes y capturas

**Carpeta de la sesión** (raíz de todas las rutas de capturas citadas):
`C:\Users\Brayan\AppData\Local\Temp\claude\c4f901e614d65603\4f5f8714-b889-4714-9ae0-ed67ee592183\scratchpad\`
Es una carpeta temporal. Si quieren conservar las capturas, cópienlas a `docs/estudio/capturas/` antes de que se limpie.

**Informes de los auditores** (JSON, en `auditoria\` dentro de esa carpeta):

| Archivo | Contenido |
|---|---|
| `audit_ux_tienda.json` | Recorridos T1 a T5 con toques actuales y propuestos; 14 hallazgos; flujo objetivo |
| `audit_benchmark.json` | 11 tiendas, patrones, antipatrones y lo que no se pudo verificar |
| `audit_visual_copy.json` | Señales de plantilla, sistema visual, tono de voz y 165 textos con propuesta |
| `audit_codigo_tienda.json` | Línea base de pruebas, hallazgos, estructura objetivo, qué rehacer y pruebas acopladas |
| `audit_nextjs.json` | Arquitectura en Next 16.3.2 verificada con prototipo, riesgos y bocetos de código |
| `audit_datos_backend.json` | Seguridad, búsqueda, caché, fotos y propuestas SQL |
| `audit_admin.json` | Panel: hallazgos, prioridades y trabajos de la administradora |
| `critica.json` | Contradicciones entre auditores y lo que nadie había revisado |
| `hueco_1.json` | Tonos: la foto como leyenda y la clasificación A a E de los 244 productos |
| `hueco_2.json` | Negocio: los $10.000, el envío, los pedidos repetidos y las leyes 1480 y 1581 |

**Capturas y evidencias** (relativas a la carpeta de la sesión):

| Carpeta | Qué contiene |
|---|---|
| `antes\` | Estado actual: `01-catalogo-inicio.png` a `12-escritorio-detalle.png` (390×844 y 1366×900) |
| `auditor-ux\out1` a `out8` | Recorridos: `p1-sticky-scroll`, `p2-gls-espacio`, `p3-tras-atras`, `p4-tras-chip`, `p5-visor`, `p5-hoja`, `p5-hoja-cambiar`, `p5-carrito`, `p7-hoja-36` |
| `auditor-codigo\out\` | Fallos verificados: `a` (reintentar), `b2` (buscador), `c` (foco de la hoja), `d` (esqueleto en la bolsa), `e` (dos pestañas), `f` (volver del detalle) |
| `benchmark\out\` | Las 11 tiendas (`plp-*`, `pdp-*`, `add-*`, `desk-*`) y Anaya (`anaya-volver`, `anaya-hoja-atras`) |
| `disenador-visual\out4\` y `out3\` | Maquetas `maqueta-catalogo.png` y `maqueta-hoja.png`; `muestra-fuentes.png` |
| `tonos-leyenda\salida\` | `hoja-contacto-tonos.png` y `.html` (12 casos) |
| `tonos-leyenda\vivo\` | `h01` a `h03` (PCL-885 en la hoja) y `cuadrados.png` (lo que corta el recorte cuadrado) |
| `tonos-leyenda\datos\` | `clasificacion.json` (89 revisados), `clase_todos.json` (244) y `analisis.json` (origen del color) |
| `tonos-leyenda\revision\` y `censo\` | Fichas `r01` a `r45` (tamaño real) y `c01` a `c10` (miniaturas) |
| `critico\fotos\` | 9 fotos de proveedor revisadas a mano |
| `auditor-admin\capturas\` | `00-login.png` y maquetas `01` a `03` del panel, con el CSS real y sin sesión |
| `arquitecto-next\out-proto2` a `out-proto9`, `out-cc1` | Registros del prototipo en Next 16.3.2 |
| `datos-auditor\dims40.txt` | Medición de 40 fotos activas |

**Documentos del repositorio citados.** `docs/superpowers/specs/2026-08-22-anaya-beauty-catalogo-design.md` (spec v1), `docs/superpowers/specs/2026-08-23-anaya-beauty-v2-design.md` (spec v2), `docs/superpowers/plans/2026-08-22-anaya-beauty.md`, `Funcionalidades.md`, `SETUP.md`, `supabase/README.md`, `supabase/schema.sql`, `supabase/policies.sql`, `supabase/functions.sql`, `supabase/migracion-v4.sql` y `Catalogo_Engol.xlsx`.

**Fuentes externas.**
- Baymard: tipos de búsqueda (`baymard.com/blog/ecommerce-search-query-types`), «Ver todo» en el menú (`/blog/mobile-main-nav-view-all`), variantes en un solo resultado (`/blog/combine-variations-one-list-item`), vistas rápidas (`/blog/mobile-desktop-quick-views`), cantidad por tanda (`/blog/number-of-items-loaded-by-default`), volver al mismo punto (`/blog/return-same-place`), filtros (`/blog/ecommerce-filter-ui`), salud y belleza (`/blog/health-and-beauty-ux-research`), descuentos en la ficha (`/blog/product-page-price-discounts`), abandono (`/blog/cart-abandonment-rate`), checkout (`/blog/current-state-of-checkout-ux`) y confirmación (`/blog/order-confirmation-page`).
- NN/g, retroalimentación al agregar a la bolsa: `nngroup.com/articles/cart-feedback/`.
- TikTok Newsroom, TikTok Shop (12-sep-2023): `newsroom.tiktok.com/en-us/introducing-tiktok-shop`.
- Shopify, precios por cantidad: `help.shopify.com/manual/b2b/catalogs/quantity-pricing`.
- Ley 1480 de 2011: `alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=44306`. Ley 1581 de 2012: `alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981`. Decreto 1074 de 2015: `normativa.colpensiones.gov.co/colpensiones/docs/decreto_1074_2015_pr025.htm` y `pr026.htm`.
