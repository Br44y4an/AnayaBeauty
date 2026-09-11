# Puesta en marcha de Anaya Beauty

Guía paso a paso. No necesitas saber programar: es copiar, pegar y hacer clic.

---

## ⚠️ ANTES DE NADA: la actualización v4

Esta versión **elimina el código de 4 dígitos**. La clienta ya no tiene que
pedirte nada por WhatsApp para confirmar: elige, pone sus datos y listo. Tú
sigues cobrando igual, a mano, después.

Para que funcione hay que ejecutar un archivo en Supabase, **y hay que hacerlo
ANTES de publicar la web nueva**. Si lo haces al revés, el catálogo se queda
sin cargar hasta que corras el archivo.

1. Entra a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**.
2. Abre el archivo `supabase/migracion-v4.sql` de este proyecto, copia **todo**
   su contenido y pégalo ahí.
3. Dale a **Run**. Tarda unos segundos.
4. (Opcional pero recomendado) Pega también `supabase/tests-v4.sql` y dale Run:
   son 12 comprobaciones que no modifican nada y te dicen si todo quedó bien.

Para confirmar que quedó, desde tu computador:

```bash
node --env-file=.env.local scripts/verificar-migracion.mjs
```

Debe terminar en **"✅ La base está lista para esta versión del código."**
Si sale en rojo, dice exactamente qué falta.

**Después** de eso ya puedes publicar la web (paso 3).

---

## Lo que ya está hecho

- ✅ Base de datos creada y verificada en Supabase
- ✅ Catálogo, carrito, pedidos y panel construidos
- ✅ Productos de ejemplo cargados para que veas cómo funciona

## Lo que falta

1. Crear la cuenta de Resend (para que lleguen los correos)
2. Subir el proyecto a GitHub
3. Publicarlo en Vercel
4. Crear los usuarios del panel
5. Cargar tus productos reales

---

## 1. Resend — que lleguen los correos de cada pedido

**Importante:** la cuenta debe crearse **con el correo `anayabeauty54@gmail.com`**.
El plan gratuito solo permite enviar correos a la dirección con la que te
registras. Si usas otra, los avisos nunca llegarán.

1. Entra a [resend.com](https://resend.com) y crea una cuenta con `anayabeauty54@gmail.com`
2. Confirma el correo que te envían
3. Ve a **API Keys** → **Create API Key**
   - Nombre: `anaya-beauty`
   - Permiso: **Sending access**
4. Copia la clave que empieza por `re_` — solo se muestra una vez

**Límites del plan gratuito:** 100 correos por día, 3.000 al mes. Si un live
supera los 100 pedidos, los siguientes no llegarán por correo, **pero ningún
pedido se pierde**: todos aparecen igual en el panel, que es la fuente principal.

---

## 2. GitHub — guardar el proyecto

Si ya tienes el repositorio creado, solo súbelo:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin feat/catalogo
```

El archivo `.env.local`, que tiene tus claves secretas, **no se sube**: está
excluido a propósito.

---

## 3. Vercel — publicar la web

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta con tu GitHub
2. **Add New** → **Project** → elige tu repositorio → **Import**
3. Antes de darle Deploy, abre **Environment Variables** y agrega estas siete:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://anayabeauty.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xvqqeedtdpqlfaaicymz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu clave `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | tu clave `sb_secret_...` |
| `RESEND_API_KEY` | la clave `re_...` del paso 1 |
| `CORREO_DESTINO` | `anayabeauty54@gmail.com` |
| `SAL_HASH_IP` | inventa un texto largo y raro, por ejemplo `anaya-2026-x7k9m2p4` |

Los valores exactos de Supabase están en tu archivo `.env.local`.

4. **Deploy** y espera unos minutos
5. Ve a **Settings** → **Domains** y pon el nombre `anayabeauty` para quedar
   en `anayabeauty.vercel.app`
6. Si cambiaste la dirección, actualiza `NEXT_PUBLIC_SITE_URL` y vuelve a
   publicar con **Redeploy**

---

## 4. Usuarios del panel

Desde la carpeta del proyecto, en la terminal:

```bash
node --env-file=.env.local scripts/crear-admin.mjs correo@ejemplo.com "UnaClaveSegura"
```

Hazlo dos veces: uno para ti y otro para tu pareja.

**Muy importante — cierra el registro abierto:**
en Supabase → **Authentication** → **Providers** → **Email**, desactiva
**"Enable sign ups"**. Sin eso, cualquiera podría registrarse y entrar al panel.

---

## 5. Cargar tus productos

Entra a `/admin/productos`. Tienes dos caminos:

- **Uno por uno**: botón "Nuevo producto". Útil para pocos.
- **Todos de golpe**: botón "Importar CSV". Descarga la plantilla, llénala en
  Excel y súbela. Es lo recomendado si tienes más de 20 productos.

En el CSV, `precio_1` es obligatorio (el precio de 1 unidad); `precio_3` y
`precio_6` los dejas vacíos si ese producto no tiene combo.

Para borrar los productos de ejemplo, ábrelos y desmarca "Visible en el catálogo".

---

## Tonos de color

Para productos que se venden en varios tonos (labiales, sombras, bases), abre
el producto en `/admin/productos` y usa la sección **Tonos de color**: eliges el
color con el selector y le pones nombre («Cereza»).

Si un producto tiene tonos, la clienta **no puede comprarlo sin elegir uno**.
El tono viaja hasta el correo y el panel, así que despachas sin preguntar nada
por chat.

El stock es del producto completo, no de cada tono. Si tienes 10 labiales y
alguien pide 5 «Cereza» y 3 «Vino», el sistema sabe que van 8 de 10.

## Descuentos

En `/admin/descuentos` manejas dos cosas:

**Precio por mayor.** Cuando un pedido llega al monto que definas (arranca en
$200.000), todos los productos pasan a su precio más barato, sin importar
cuántas unidades lleve de cada uno.

**Descuento por porcentaje.** Reglas del tipo «desde $50.000 → 5%». Puedes
agregar las que quieras; si una clienta alcanza varias, se le aplica la de
mayor monto.

Los dos se suman, en este orden:

```
1. Se suman los productos con su precio según la cantidad
2. Si llega al umbral → todo al precio más barato
3. Sobre ese resultado → el porcentaje que corresponda
```

Ejemplo real, verificado: un carrito de $200.000 activa el por mayor y baja a
$196.000; encima se le aplica el 5% y queda en **$186.200**.

El umbral se mide **antes** de rebajar. Una vez aplicado el por mayor no se
quita, aunque el total quede por debajo del umbral.

## Cómo se usa en cada transmisión

**Antes de empezar:** abre `/admin` (pedidos). Ya no hace falta la pestaña de
códigos: desapareció.

**Durante el live:**

1. Muestras el QR (lo descargas desde `/admin/qr`)
2. La clienta entra, elige sus productos y **confirma ella sola**, sin
   esperarte y sin pedirte ningún código
3. El pedido aparece en `/admin` sin que tengas que refrescar, y te llega el
   correo con todo el detalle (incluida la nota que ella haya escrito)
4. Ella ve en pantalla tus datos de pago, con un botón para copiar el número,
   y te manda el comprobante por WhatsApp con un toque

**Al terminar:** marcas como "pagado" los que ya te transfirieron y como
"enviado" los que despachaste.

**¿Y si alguien pide sin pagar?** Igual que antes: el pedido queda en "nuevo"
y tú decides. Si no paga, lo cancelas desde `/admin` y **el stock vuelve solo
al inventario**. La diferencia es que ahora no pierdes las ventas de las que sí
iban a pagar y se cansaron de esperar el código.

---

## Si algo falla

**No llegan los correos**
Corre esto y te dirá exactamente qué está mal:

```bash
curl -H "x-clave-diagnostico: anaya-diag-8f3k92mz"   "https://anaya-beauty-tau.vercel.app/api/diagnostico?correo=1"
```

La causa más común: la cuenta de Resend se creó con otro correo. El plan
gratuito **solo envía a la dirección con la que te registraste**, así que la
cuenta tiene que ser de `anayabeauty54@gmail.com`. Si pasaste de 100 correos
hoy, espera a mañana: los pedidos siguen llegando al panel igual.

**Una clienta dice que confirmó dos veces sin querer**
No pasa nada: el sistema reconoce el reenvío y le devuelve el pedido que ya
había creado. No se duplica ni se descuenta el stock dos veces. Si aun así ves
dos pedidos iguales, cancela uno desde `/admin` y el inventario vuelve solo.

**Le sale "Ya recibimos varios pedidos desde este dispositivo"**
Es el freno contra el abuso: más de 6 pedidos en 10 minutos desde el mismo
dispositivo. Si es una clienta real (una tienda comprando para varias
personas), dile que espere unos minutos o tómale el pedido tú por WhatsApp.

**El stock quedó mal**
Busca el pedido en `/admin` y márcalo como "cancelado": el sistema devuelve
automáticamente esas unidades al inventario.

**Una clienta dice que se le agotó algo al confirmar**
Alguien más lo compró primero. El sistema apartó bien el inventario y evitó
vender dos veces lo mismo. Ofrécele otro producto.

**Quiero cambiar el número de Nequi**
`/admin/configuracion`. Se actualiza en la web al instante.
