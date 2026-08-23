# Anaya Beauty v2 — Tonos, compra rápida y descuentos

Fecha: 2026-08-23
Estado: diseño aprobado
Antecede: `2026-08-22-anaya-beauty-catalogo-design.md`

## 1. Qué cambia y por qué

La primera versión ya opera. Estos seis cambios salen de usarla:

1. **Compra desde la tarjeta.** Entrar al detalle para agregar cada producto es
   demasiada fricción durante un live. Los botones de más y menos pasan a la
   tarjeta del catálogo.
2. **Ver la imagen en grande.** La clienta necesita apreciar el producto antes
   de decidir; la miniatura no basta.
3. **Tonos de color.** Un labial no se vende sin saber qué tono quiere la
   clienta. Hoy el pedido llega sin ese dato y toca preguntarlo por chat.
4. **Precio por mayor automático.** Quien gasta mucho debe recibir el mejor
   precio de cada producto, sin importar cuántas unidades lleve de cada uno.
5. **Descuento por monto.** Un porcentaje sobre el total, administrable, para
   premiar carritos grandes.
6. **Pago por llave** en lugar de Nequi.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Stock con tonos | El stock sigue siendo del producto completo. El tono es la preferencia que la clienta indica, no un inventario aparte. |
| Descuentos | En cascada: primero el precio por mayor, después el porcentaje sobre el resultado. |
| Umbral del por mayor | Editable desde el panel; arranca en $200.000. |

**Riesgo aceptado conscientemente:** con stock por producto, el sistema permite
pedir cinco unidades del tono «Cereza» aunque solo queden dos de ese tono. La
administradora lo resuelve al despachar. Llevar inventario por tono exigiría
cargar stock tono por tono, y se prefirió la simplicidad.

## 3. Tonos de color

### Datos
Tabla `product_shades`: `id, product_id, nombre, color_hex, orden`.
Un producto puede tener cero tonos (una brocha) o varios (un labial).
`order_items` gana la columna `tono_snapshot`, congelada como el resto de la
línea: si el tono se renombra después, el pedido histórico no cambia.

### Reglas
- Si el producto tiene tonos, **elegir uno es obligatorio** antes de agregar al
  carrito. La interfaz no ofrece el botón hasta que hay tono elegido.
- La línea del carrito pasa a ser *producto + tono*. Dos tonos del mismo
  producto son dos líneas independientes, cada una con su cantidad.
- El tono viaja hasta el correo y el panel: «Labial Rojo Pasión · Cereza x3».

### Interfaz
En el panel, el formulario de producto gana una sección de tonos con nombre y
selector de color, mostrando el círculo resultante. En el catálogo, los tonos
son círculos de color con el nombre accesible para lectores de pantalla; el
color nunca es el único indicador: el tono elegido se nombra en texto.

## 4. Compra desde la tarjeta y visor de imagen

La tarjeta del catálogo deja de ser solo un enlace:

- Sin tonos: botones de más y menos directamente, con el subtotal y la
  sugerencia de subir al siguiente escalón.
- Con tonos: primero los círculos; al elegir uno aparecen los controles.
- El nombre sigue llevando al detalle, para quien quiera leer la descripción.
- Tocar la imagen abre un **visor a pantalla completa** con la imagen en su
  resolución original. Se cierra con la tecla Escape, con el botón, o tocando
  el fondo.

## 5. Motor de descuentos

### Datos
- Tabla `discount_rules`: `id, monto_minimo, porcentaje, activo`.
  Fila inicial: desde $50.000 → 5%.
- Ajuste `umbral_por_mayor` en `store_settings`, inicial `200000`.

### Cascada de cálculo

```
1. subtotalNormal  = suma de los escalones según la cantidad de cada línea
2. si subtotalNormal >= umbral:
      subtotalBase = suma usando el precio MÁS BAJO de cada producto
   si no:
      subtotalBase = subtotalNormal
3. regla = la de mayor monto_minimo que subtotalBase alcance, entre las activas
4. descuento = redondear(subtotalBase * regla.porcentaje / 100)
5. total = subtotalBase - descuento
```

**El umbral se evalúa contra `subtotalNormal` y la decisión no se revierte.**
Sin esa regla el cálculo entraría en un bucle: aplicar el por mayor baja el
total por debajo del umbral, lo que desactivaría el por mayor, lo que volvería
a subirlo.

El porcentaje se evalúa contra `subtotalBase`, es decir, después del por mayor.

### Dónde vive
Una función pura, `calcularTotales`, en `src/lib/discounts.ts`, usada por el
carrito y el correo. La misma regla se replica dentro de `crear_pedido` en
PostgreSQL, porque **el total que se cobra siempre se calcula en el servidor**.
Las pruebas comparan ambas implementaciones con los mismos casos.

### Lo que ve la clienta
El carrito muestra el desglose completo: subtotal, «precio por mayor aplicado»
cuando corresponde, el porcentaje de descuento, y el total. Ver el ahorro
explícito es lo que motiva a subir el carrito.

## 6. Datos de pago

Pasan de Nequi a llave, editables desde el panel como hasta ahora:

| Clave | Valor |
|---|---|
| `pago_metodo` | Llave |
| `pago_numero` | @RP3228813646 |
| `pago_titular` | A** Ma** Sar** Rod*** |

## 7. Pruebas

- **Motor de descuentos**: unitarias sobre la cascada — por debajo del umbral,
  justo en el umbral, por encima, con y sin regla de porcentaje aplicable, y el
  caso en que el por mayor deja el total por debajo del umbral (no se revierte).
- **Paridad TypeScript/PostgreSQL**: los mismos carritos calculados por ambas
  implementaciones deben dar el mismo total al peso.
- **Tonos**: no se puede agregar al carrito sin elegir tono cuando el producto
  tiene tonos; dos tonos del mismo producto son líneas separadas; el tono llega
  al pedido guardado.
- **Tarjeta**: los controles respetan el stock; el visor abre y cierra.
- **Verificación en producción**: un pedido real que ejercite por mayor y
  descuento, comprobando el total cobrado y el contenido del correo.

## 8. Fuera de alcance

Inventario por tono, imágenes por tono, cupones de un solo uso, descuentos por
categoría o por producto, y envío calculado. Ninguno hace falta para operar.
