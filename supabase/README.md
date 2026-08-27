# Base de datos de Anaya Beauty

Ejecuta estos archivos en el editor SQL de Supabase, **en este orden**:

1. `schema.sql` — tablas, índices y configuración inicial
2. `policies.sql` — reglas de seguridad (Row Level Security)
3. `functions.sql` — funciones de pedidos y códigos
4. `migracion-v2.sql` — tonos de color, precio por mayor y descuentos por
   monto; también reemplaza `crear_pedido` por la versión que de verdad
   aplica esos beneficios (la de `functions.sql` sola no los tiene)
5. `tests.sql` — verificación; debe terminar con "TODAS LAS PRUEBAS PASARON"

Los cinco archivos son idempotentes: puedes volver a ejecutarlos sin dañar
los datos existentes. `tests.sql` no cubre tonos/descuentos/precio por
mayor todavía — para eso corre `node --env-file=.env.local
scripts/probar-descuentos.mjs` contra la base real.

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
