# Puesta en marcha de Anaya Beauty

Guía paso a paso. No necesitas saber programar: es copiar, pegar y hacer clic.

---

## Antes de nada: la actualización v5 (rediseño)

La v5 trae la tienda nueva (búsqueda que entiende «rimel» o «usk621», departamentos,
varios tonos de una vez, bolsa y página del pedido nuevas) y un panel más seguro: solo
las cuentas registradas como administradoras ven pedidos y guardan cambios.

La base se actualiza **antes** de publicar la web nueva. La migración es compatible con
la web actual, así que puedes aplicarla sin miedo.

1. Entra a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**.
2. Si la base todavía no tiene la v4, ejecuta primero `supabase/migracion-v4.sql`.
3. Abre `supabase/migracion-v5.sql`, copia **todo** su contenido, pégalo y dale **Run**.
4. Pega también `supabase/tests-v5.sql` y dale Run: no modifica nada y debe terminar en
   "TODAS LAS PRUEBAS V5 PASARON".

Para confirmar que quedó, desde tu computador:

```bash
node --env-file=.env.local scripts/verificar-migracion.mjs
```

Debe terminar en **"La base está lista para esta versión del código."** Si algo falta,
dice exactamente qué. Los avisos (por ejemplo, el registro de cuentas abierto) no
impiden publicar, pero atiéndelos (ver «Después de publicar la v5»).

**Después** de eso publica la web (paso 3) y, ya publicada, ejecuta
`supabase/migracion-v5-departamentos.sql`, que crea los 7 departamentos. El orden
completo y cómo revertir están en `supabase/README.md`.

---

## Lo que ya está hecho

- Base de datos creada y verificada en Supabase
- Catálogo, bolsa, pedidos y panel construidos
- Productos de ejemplo cargados para que veas cómo funciona

## Lo que falta

1. Crear la cuenta de Resend (para que lleguen los correos)
2. Subir el proyecto a GitHub
3. Publicarlo en Vercel
4. Crear los usuarios del panel
5. Cargar tus productos reales

---

## 1. Resend: que lleguen los correos de cada pedido

**Importante:** la cuenta debe crearse **con el correo `anayabeauty54@gmail.com`**.
El plan gratuito solo permite enviar correos a la dirección con la que te
registras. Si usas otra, los avisos nunca llegarán.

1. Entra a [resend.com](https://resend.com) y crea una cuenta con `anayabeauty54@gmail.com`
2. Confirma el correo que te envían
3. Ve a **API Keys** → **Create API Key**
   - Nombre: `anaya-beauty`
   - Permiso: **Sending access**
4. Copia la clave que empieza por `re_` (solo se muestra una vez)

**Límites del plan gratuito:** 100 correos por día, 3.000 al mes. Si un live
supera los 100 pedidos, los siguientes no llegarán por correo, **pero ningún
pedido se pierde**: todos aparecen igual en el panel, que es la fuente principal.

---

## 2. GitHub: guardar el proyecto

Si ya tienes el repositorio creado, solo súbelo:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin feat/catalogo
```

El archivo `.env.local`, que tiene tus claves secretas, **no se sube**: está
excluido a propósito. Ninguna clave se escribe en este archivo ni en otro del
repositorio: el repositorio es público.

---

## 3. Vercel: publicar la web

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta con tu GitHub
2. **Add New** → **Project** → elige tu repositorio → **Import**
3. Antes de darle Deploy, abre **Environment Variables** y agrega estas ocho:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://anayabeauty.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xvqqeedtdpqlfaaicymz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu clave `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | tu clave `sb_secret_...` |
| `RESEND_API_KEY` | la clave `re_...` del paso 1 |
| `CORREO_DESTINO` | `anayabeauty54@gmail.com` |
| `SAL_HASH_IP` | inventa un texto largo y raro (20 caracteres o más); no copies ninguno de un ejemplo |
| `CLAVE_DIAGNOSTICO` | inventa otra clave larga (20 caracteres o más) y guárdala solo en tu gestor de contraseñas |

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

Hazlo una vez por persona (tú y tu pareja). El script crea la cuenta (o le cambia
la contraseña si ya existe) y la registra como administradora. Una cuenta que no
esté registrada no entra al panel: al iniciar sesión ve «Esta cuenta no tiene
acceso al panel».

**Muy importante: cierra el registro abierto.**
En Supabase → **Authentication** → **Sign In / Providers**, desactiva
**"Allow new users to sign up"**. Con la v5 una cuenta nueva ya no administra
nada, pero con el registro abierto cualquiera puede seguir creando cuentas.
`scripts/verificar-migracion.mjs` te avisa si sigue abierto.

---

## 5. Cargar tus productos

Entra a `/admin/productos`. Tienes dos caminos:

- **Uno por uno**: botón "Nuevo producto". Útil para pocos.
- **Todos de golpe**: botón "Importar CSV". Descarga la plantilla, llénala en
  Excel y súbela. Es lo recomendado si tienes más de 20 productos.

En el CSV, `precio_1` es obligatorio para los productos nuevos (el precio de 1
unidad); `precio_3` y `precio_6` los dejas vacíos si ese producto no tiene precio
por cantidad.

Si una referencia del CSV ya existe, solo se actualizan las columnas que traen
valor: una columna vacía no borra nada y el importador nunca cambia si un producto
está visible u oculto. Antes de confirmar te muestra el resumen de los cambios.

**Cargue inicial desde el Excel de Engol.** `scripts/cargar-catalogo-engol.mjs`
**solo agrega referencias nuevas**, en borrador. Las que ya existen en la base no
se tocan (ni foto, ni nombre, ni stock, ni visibilidad), así que no sirve para
actualizar productos: para eso usa el panel o el CSV. Si necesita crear
categorías, las deja ocultas: en `/admin/categorias` asígnales departamento y
actívalas cuando publiques sus productos.

Para retirar los productos de ejemplo, ábrelos y desmarca "Visible en el catálogo".

---

## Tonos, colores y diseños

Para productos que se venden en varias opciones (labiales, sombras, bases,
accesorios), abre el producto en `/admin/productos` y usa el editor de
variantes. Cada producto dice cómo se llaman sus opciones (Tono, Color, Diseño,
Modelo…); si no eliges, usa la de su categoría.

Guarda las variantes **en el mismo orden de la foto**: la clienta elige
mirando la foto, y «Tono 3» tiene que ser el tercero de la imagen.

Cuando una variante se acabe, **márcala como agotada con su interruptor; no
la borres.** Borrarla corre la numeración y la foto deja de coincidir.

Si un producto tiene variantes, la clienta **no puede comprarlo sin elegir una**.
La variante viaja hasta el correo y el panel, así que despachas sin preguntar
nada por chat.

El stock es del producto completo, no de cada variante. Si tienes 10 labiales y
alguien pide 5 «Cereza» y 3 «Vino», el sistema sabe que van 8 de 10.

## Descuentos

En `/admin/descuentos` manejas dos cosas:

**Precio por mayor.** Cuando un pedido llega al monto que definas (arranca en
$200.000), todos los productos pasan a su precio más barato, sin importar
cuántas unidades lleve de cada uno.

**Descuento por porcentaje.** Reglas del tipo «desde $50.000 → 5 %». Puedes
agregar las que quieras; si una clienta alcanza varias, se le aplica la de
mayor monto.

Los dos se suman, en este orden:

```
1. Se suman los productos con su precio según la cantidad
2. Si llega al umbral → todo al precio más barato
3. Sobre ese resultado → el porcentaje que corresponda
```

Ejemplo real, verificado: un pedido de $200.000 activa el por mayor y baja a
$196.000; encima se le aplica el 5 % y queda en **$186.200**.

El umbral se mide **antes** de rebajar. Una vez aplicado el por mayor no se
quita, aunque el total quede por debajo del umbral.

## Cómo se usa en cada transmisión

**Antes de empezar:** abre `/admin` (pedidos).

**Durante el live:**

1. Muestras el QR (lo descargas desde `/admin/qr`)
2. La clienta entra, elige sus productos y **confirma ella sola**, sin
   esperarte y sin pedirte ningún código
3. El pedido aparece en `/admin` sin que tengas que refrescar, y te llega el
   correo con todo el detalle (incluida la nota que ella haya escrito)
4. Ella ve en pantalla tus datos de pago, con un botón para copiar el número,
   y te manda el comprobante por WhatsApp con un toque

**Al terminar:** usa «Confirmar pago» en los que ya te transfirieron y «Marcar
enviado» en los que despachaste.

**¿Y si alguien pide sin pagar?** El pedido queda en "nuevo" y tú decides. Si
no paga, lo cancelas desde `/admin` y **el stock vuelve solo al inventario**.

---

## Después de publicar la v5

- Cierra el registro de cuentas nuevas y, si tu plan lo permite, activa la
  protección de contraseñas filtradas (Supabase → Authentication).
- **Cambia la clave de diagnóstico.** Una versión anterior de esta guía la tenía
  escrita y quedó en el historial público del repositorio. Inventa una nueva,
  ponla en Vercel → **Settings** → **Environment Variables** → `CLAVE_DIAGNOSTICO`
  y dale **Redeploy**. La vieja deja de servir en cuanto se publica.
- Escribe el texto real de envío en `/admin/configuracion` → «Información de
  envío». Mientras tanto la tienda dice «El envío se coordina por WhatsApp
  después de confirmar tu pedido.»
- Completa tu identidad legal (NIT y dirección) en la página `/privacidad`.

---

## Si algo falla

**No llegan los correos**
Corre esto (cambia `<tu-clave-de-diagnóstico>` por la clave que pusiste en Vercel
como `CLAVE_DIAGNOSTICO`) y te dirá exactamente qué está mal:

```bash
curl -H "x-clave-diagnostico: <tu-clave-de-diagnóstico>" "https://anaya-beauty-tau.vercel.app/api/diagnostico?correo=1"
```

Con `?correo=1` envía un correo de prueba con la plantilla real; sin él solo
revisa la configuración y la base, sin enviar nada. Si la clave no coincide,
responde 404 y no muestra nada.

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
Busca el pedido en `/admin` y cancélalo: el sistema devuelve automáticamente
esas unidades al inventario.

**Una clienta dice que se le agotó algo al confirmar**
Alguien más lo compró primero. El sistema apartó bien el inventario y evitó
vender dos veces lo mismo. Ofrécele otro producto.

**Al entrar al panel dice «Esta cuenta no tiene acceso al panel»**
Tu cuenta no está registrada como administradora. Corre otra vez
`scripts/crear-admin.mjs` con tu correo y una contraseña (puede ser la misma o
una nueva) y vuelve a entrar.

**Quiero cambiar el número de Nequi**
`/admin/configuracion`. Se actualiza en la web al instante.
