# Base de datos de Anaya Beauty

Ejecuta estos archivos en el editor SQL de Supabase, **en este orden**:

1. `schema.sql` — tablas, índices y configuración inicial
2. `policies.sql` — reglas de seguridad (Row Level Security)
3. `functions.sql` — funciones de pedidos
4. `migracion-v2.sql` — tonos de color, precio por mayor y descuentos por
   monto; también reemplaza `crear_pedido` por la versión que de verdad
   aplica esos beneficios (la de `functions.sql` sola no los tiene)
5. `migracion-v3.sql` — el escalón de precio lo decide la cantidad total del
   producto, sumando todos sus tonos
6. `migracion-v4.sql` — pedido sin código de acceso, reintento seguro por
   clave de idempotencia, límite por dispositivo y columnas calculadas
   (`precio_desde`, `precio_base`, `num_tonos`) que permiten paginar y ordenar
   el catálogo en la base
7. `tests-v4.sql` — verificación; debe terminar con "TODAS LAS PRUEBAS PASARON"
8. **`migracion-v5.sql`** — rediseño: búsqueda que entiende tildes, plurales y
   referencias sin guion (`buscar_productos`), categorías de dos niveles,
   etiqueta de variante (Tono, Color, Diseño…), tono agotado, producto
   destacado, versión de la política aceptada en el pedido, texto de envío
   (`envio_info`), administradoras (`administradores` y `es_admin()` en todas
   las políticas de escritura y en el bucket de fotos), estados de pedido
   validados (`cambiar_estado_pedido`), cancelar que devuelve todo el stock y
   pedidos en vivo (Realtime). No borra nada: la web v4 sigue funcionando.
9. `tests-v5.sql` — verificación; debe terminar con "TODAS LAS PRUEBAS V5 PASARON"
10. `migracion-v5-departamentos.sql` — **solo después de publicar la web v5**:
    crea los 7 departamentos (Rostro, Ojos y cejas, Labios, Brochas y
    herramientas, Cuidado personal, Cabello y peinado, Bolsos y accesorios) y
    les asigna sus categorías. Antes de eso, la web vieja los mostraría vacíos.

Todos son idempotentes: puedes volver a ejecutarlos sin dañar los datos
existentes. Las pruebas terminan en `rollback`, así que no dejan datos;
`tests-v4.sql` sí gasta números de pedido (la secuencia no se revierte y el
siguiente pedido real se salta esos números), `tests-v5.sql` no.

> `tests.sql` quedó obsoleto: probaba el flujo con código de acceso, que la v4
> eliminó.

**Orden de despliegue v4:** primero el SQL, después la web. La v4 cambia la firma
de `crear_pedido` y añade columnas que el catálogo consulta, así que publicar
la web antes deja la tienda sin cargar. Para comprobarlo:
`node --env-file=.env.local scripts/verificar-migracion.mjs`.

**Orden de despliegue v5:**

1. `migracion-v5.sql` y `tests-v5.sql` (la web v4 sigue funcionando).
2. Publicar la web v5.
3. `migracion-v5-departamentos.sql`.

**Revertir la v5:** `revertir-v5.sql` deja las categorías planas otra vez y
borra los 7 departamentos; si alguno ya tiene productos propios, se conserva y
se avisa para moverlos. Las columnas, funciones y políticas de la v5 se quedan:
la web vieja funciona con ellas.

## Administradoras

Desde la v5, tener sesión no basta: el panel solo lee pedidos y escribe si la
cuenta está en la tabla `administradores`. La migración registra las cuentas
confirmadas que existan la primera vez que se aplica; volver a correrla no
agrega a nadie.

Para dar acceso a una cuenta nueva:

1. Con `scripts/crear-admin.mjs` (recomendado): crea la cuenta y ya la registra
   en `administradores`; no hace falta nada más.
2. Si la creas desde Authentication → Users → Add user (con "Auto Confirm
   User"), esa cuenta no queda registrada: agrégala en el editor SQL:

   ```sql
   insert into administradores (user_id)
   select id from auth.users where email = 'correo@ejemplo.com';
   ```

Para quitarle el acceso: `delete from administradores where user_id = '…';`.

> **Desactiva el registro público.** En Authentication → Sign In / Providers,
> apaga "Allow new users to sign up" y, si tu plan lo permite, activa la
> protección de contraseñas filtradas. Con la v5 una cuenta nueva ya no
> administra nada, pero con el registro abierto cualquiera puede seguir
> creando cuentas.

## Storage

Crea un bucket **público** llamado `productos`. La migración v5 le pone su
política (`productos_admin`): solo las administradoras suben, reemplazan o
borran fotos. Las fotos se leen por su URL pública, sin política de lectura; no
agregues una para `anon`, porque dejaría listar todo el bucket.

Si seguiste una versión anterior de este archivo y creaste `productos_escritura`
o `productos_borrado`, la v5 también las limita a las administradoras; puedes
borrarlas.

Si creaste `productos_lectura` en storage.objects, bórrala: deja listar todo el
bucket y las fotos se leen igual por su URL pública.

## Realtime

Lo activa `migracion-v5.sql`: publica `orders` en `supabase_realtime`, así los
pedidos aparecen solos en el panel durante los lives.
