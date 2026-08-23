# Puesta en marcha de Anaya Beauty

Guía paso a paso. No necesitas saber programar: es copiar, pegar y hacer clic.

---

## Lo que ya está hecho

- ✅ Base de datos creada y verificada en Supabase
- ✅ Catálogo, carrito, códigos, pedidos y panel construidos
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

## Cómo se usa en cada transmisión

**Antes de empezar:** abre dos pestañas, `/admin` (pedidos) y `/admin/codigos`.

**Durante el live:**

1. Muestras el QR (lo descargas desde `/admin/qr`)
2. Una clienta transfiere los 10.000 y te manda el comprobante
3. En `/admin/codigos` das **"Generar código nuevo"**
4. Aprietas **"Copiar mensaje"** y lo pegas en su chat de WhatsApp
5. Ella toca el link, el código se aplica solo, elige sus productos y confirma
6. El pedido aparece en `/admin` sin que tengas que refrescar, y te llega el correo

**Al terminar:** marcas como "pagado" los que ya te transfirieron y como
"enviado" los que despachaste.

---

## Si algo falla

**No llegan los correos**
Revisa que la cuenta de Resend esté registrada con `anayabeauty54@gmail.com` y
que `RESEND_API_KEY` esté bien puesta en Vercel. Si pasaste de 100 correos hoy,
espera a mañana: los pedidos siguen llegando al panel igual.

**Una clienta dice que su código no funciona**
Búscalo en `/admin/codigos`. Si dice "Usado", ya lo gastó. Si dice "Vencido",
pasaron más de 24 horas: genérale uno nuevo. Puedes cambiar esa duración en
**Ajustes**.

**El stock quedó mal**
Busca el pedido en `/admin` y márcalo como "cancelado": el sistema devuelve
automáticamente esas unidades al inventario.

**Una clienta dice que se le agotó algo al confirmar**
Alguien más lo compró primero. El sistema apartó bien el inventario y evitó
vender dos veces lo mismo. Ofrécele otro producto.

**Quiero cambiar el número de Nequi**
`/admin/configuracion`. Se actualiza en la web al instante.
