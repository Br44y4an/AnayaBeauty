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
6. **`migracion-v4.sql`** — pedido sin código de acceso, reintento seguro por
   clave de idempotencia, límite por dispositivo y columnas calculadas
   (`precio_desde`, `precio_base`, `num_tonos`) que permiten paginar y ordenar
   el catálogo en la base
7. `tests-v4.sql` — verificación; debe terminar con "TODAS LAS PRUEBAS PASARON"

Todos son idempotentes: puedes volver a ejecutarlos sin dañar los datos
existentes, y `tests-v4.sql` termina en `rollback`, así que no deja rastro.

> `tests.sql` quedó obsoleto: probaba el flujo con código de acceso, que la v4
> eliminó.

**Orden de despliegue:** primero el SQL, después la web. La v4 cambia la firma
de `crear_pedido` y añade columnas que el catálogo consulta, así que publicar
la web antes deja la tienda sin cargar. Para comprobarlo:
`node --env-file=.env.local scripts/verificar-migracion.mjs`.

## Storage

Crea un bucket **público** llamado `productos` para las imágenes, y luego
ejecuta en el editor SQL:

```sql
drop policy if exists productos_lectura on storage.objects;
create policy productos_lectura on storage.objects
  for select to anon, authenticated using (bucket_id = 'productos');

drop policy if exists productos_escritura on storage.objects;
create policy productos_escritura on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists productos_borrado on storage.objects;
create policy productos_borrado on storage.objects
  for delete to authenticated using (bucket_id = 'productos');
```

## Realtime

En Database → Replication → `supabase_realtime`, activa la tabla `orders`.
Sin esto, los pedidos no aparecen solos en el panel durante los lives.

## Usuarios del panel

En Authentication → Users → Add user, crea los dos usuarios con
"Auto Confirm User" activado.

Luego, en Authentication → Providers → Email, **desactiva "Enable sign ups"**.
Sin eso, cualquiera podría registrarse y tendría acceso total al panel.
