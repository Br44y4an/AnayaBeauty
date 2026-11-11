-- Anaya Beauty · pruebas de la migración v5. Correr después de migracion-v5.sql.
-- Todo ocurre en una transacción que termina en rollback: no deja datos ni consume números de pedido.
-- Si algo falla, la ejecución se detiene con «FALLO n — …»; si todo pasa, termina con TODAS LAS PRUEBAS V5 PASARON.

begin;

-- Montaje: un departamento con una categoría, cuatro productos activos, uno oculto y tres tonos.
insert into categories (nombre, slug, orden, etiqueta_variante)
values ('Departamento Zzalfa', 'zz-v5-departamento', 999, 'Tono');

insert into categories (nombre, slug, orden, categoria_padre_id)
select 'Categoría Zzbeta', 'zz-v5-categoria', 999, id from categories where slug = 'zz-v5-departamento';

insert into products (referencia, nombre, descripcion, category_id, stock, activo)
select t.referencia, t.nombre, t.descripcion, c.id, 20, t.activo
  from categories c,
       (values ('USK-621-ZZV5', 'USK-621 Paleta',       'Paleta de sombras', true),
               ('ZZV5-002',     'Pestañas postizas 3D', null,                true),
               ('ZZV5-003',     'Brocha para polvo',    null,                true),
               ('ZZV5-004',     'Pestañina waterproof', null,                true),
               ('ZZV5-005',     'Brocha oculta',        null,                false)) as t(referencia, nombre, descripcion, activo)
 where c.slug = 'zz-v5-categoria';

insert into product_shades (product_id, nombre, color_hex, orden)
select p.id, t.nombre, t.hex, t.orden
  from products p,
       (values ('Tono 1', '#A83A5C', 1), ('Tono 2', '#C9727F', 2), ('Rojo pasión', '#B01030', 3)) as t(nombre, hex, orden)
 where p.referencia = 'USK-621-ZZV5';

-- 1. normalizar
do $$
begin
  if normalizar('Pestañas ÚNICAS: Ç, Ü y áéíóú') is distinct from 'pestanas unicas: c, u y aeiou' then
    raise exception 'FALLO 1 — normalizar no quitó tildes o mayúsculas: %', normalizar('Pestañas ÚNICAS: Ç, Ü y áéíóú');
  end if;
  if normalizar(null) is not null then
    raise exception 'FALLO 1 — normalizar(null) debería ser null';
  end if;
  raise notice 'OK 1 — normalizar quita tildes y pasa a minúsculas';
end $$;

-- 2. buscar_productos
do $$
declare
  v_departamento uuid := (select id from categories where slug = 'zz-v5-departamento');
  v_categoria    uuid := (select id from categories where slug = 'zz-v5-categoria');
  v_todos        text := 'Brocha para polvo + Pestañas postizas 3D + Pestañina waterproof + USK-621 Paleta';
  v_encontrados  text;
  c              record;
begin
  for c in
    select * from (values
      ('«usk621» por la referencia sin guion', array['usk621'],                 array[v_categoria],       'USK-621 Paleta'),
      ('«usk 621» en dos palabras',           array['usk', '621'],              array[v_categoria],       'USK-621 Paleta'),
      ('«pestanas» sin tilde ni plural',      array['pestana'],                 array[v_categoria],       'Pestañas postizas 3D'),
      ('«brocha polvo» sin «para»',           array['brocha', 'polvo'],         array[v_categoria],       'Brocha para polvo'),
      ('sinónimos de rímel',                  array['rimel|mascara|pestanina'], array[v_categoria],       'Pestañina waterproof'),
      ('el departamento incluye sus hijas',   array['pestana'],                 array[v_departamento],    'Pestañas postizas 3D'),
      ('otra categoría no trae nada',         array['pestana'],                 array[gen_random_uuid()], null),
      ('por el nombre de un tono',            array['pasion'],                  array[v_categoria],       'USK-621 Paleta'),
      ('por la descripción',                  array['sombra'],                  array[v_categoria],       'USK-621 Paleta'),
      ('por el departamento, sin filtro',     array['zzalfa'],                  null::uuid[],             v_todos),
      ('por la categoría, sin filtro',        array['zzbeta'],                  null::uuid[],             v_todos),
      ('lo que llega también se normaliza',   array['PESTAÑA'],                 array[v_categoria],       'Pestañas postizas 3D'),
      ('todos los grupos deben coincidir',    array['brocha', 'pestana'],       array[v_categoria],       null),
      ('los grupos vacíos no filtran',        array['zzalfa', '', '|'],         null::uuid[],             v_todos),
      ('una alternativa vacía no es comodín', array['zzalfa', 'noexiste|'],     null::uuid[],             null)
    ) as t(caso, grupos, categorias, esperado)
  loop
    select string_agg(nombre, ' + ' order by nombre collate "C") into v_encontrados
      from buscar_productos(c.grupos, c.categorias);
    if v_encontrados is distinct from c.esperado then
      raise exception 'FALLO 2 — %: se esperaba «%» y llegó «%»', c.caso, coalesce(c.esperado, 'nada'), coalesce(v_encontrados, 'nada');
    end if;
  end loop;

  -- La clienta busca con la clave anónima: el producto oculto tampoco le llega.
  set local role anon;
  select string_agg(nombre, ' + ' order by nombre collate "C") into v_encontrados from buscar_productos(array['zzalfa']);
  reset role;
  if v_encontrados is distinct from v_todos then
    raise exception 'FALLO 2 — como anon se esperaba «%» y llegó «%»', v_todos, coalesce(v_encontrados, 'nada');
  end if;
  raise notice 'OK 2 — buscar_productos entiende referencias, tildes, plurales, sinónimos, tonos y departamentos';
end $$;

-- 3. Categorías de dos niveles
do $$
declare
  v_departamento uuid := (select id from categories where slug = 'zz-v5-departamento');
  v_categoria    uuid := (select id from categories where slug = 'zz-v5-categoria');
  v_circular     uuid := gen_random_uuid();
  v_otra         uuid;
begin
  insert into categories (nombre, slug) values ('Otra raíz', 'zz-v5-otra') returning id into v_otra;

  begin
    insert into categories (nombre, slug, categoria_padre_id) values ('Nieta', 'zz-v5-nieta', v_categoria);
    raise exception 'FALLO 3 — se aceptó una nieta (tres niveles)';
  exception when others then
    if sqlerrm <> 'CATEGORIA_PROFUNDIDAD' then raise; end if;
  end;

  begin
    update categories set categoria_padre_id = v_otra where id = v_departamento;
    raise exception 'FALLO 3 — un departamento con hijas quedó dentro de otra categoría';
  exception when others then
    if sqlerrm <> 'CATEGORIA_PROFUNDIDAD' then raise; end if;
  end;

  begin
    update categories set categoria_padre_id = v_categoria where id = v_otra;
    raise exception 'FALLO 3 — una categoría quedó dentro de una hija';
  exception when others then
    if sqlerrm <> 'CATEGORIA_PROFUNDIDAD' then raise; end if;
  end;

  begin
    insert into categories (id, nombre, slug, categoria_padre_id) values (v_circular, 'Circular', 'zz-v5-circular', v_circular);
    raise exception 'FALLO 3 — una categoría quedó como su propia madre';
  exception when check_violation then null;
  end;

  update categories set categoria_padre_id = v_departamento where id = v_otra;
  raise notice 'OK 3 — las categorías tienen como mucho dos niveles y ninguna es su propia madre';
end $$;

-- 4. Etiqueta de variante y columnas nuevas
do $$
begin
  begin
    insert into categories (nombre, slug, etiqueta_variante) values ('Sabores', 'zz-v5-sabores', 'Sabor');
    raise exception 'FALLO 4 — se aceptó la etiqueta «Sabor» en una categoría';
  exception when check_violation then null;
  end;

  begin
    update products set etiqueta_variante = 'tono' where referencia = 'ZZV5-002';
    raise exception 'FALLO 4 — se aceptó la etiqueta «tono» en minúscula en un producto';
  exception when check_violation then null;
  end;

  update products set etiqueta_variante = 'Diseño' where referencia = 'ZZV5-002';
  update categories set etiqueta_variante = 'Paleta' where slug = 'zz-v5-categoria';

  if exists (select 1 from products where referencia like '%ZZV5%' and destacado) then
    raise exception 'FALLO 4 — un producto nuevo no debería nacer destacado';
  end if;
  if exists (select 1 from product_shades s join products p on p.id = s.product_id
              where p.referencia = 'USK-621-ZZV5' and s.agotado) then
    raise exception 'FALLO 4 — un tono nuevo no debería nacer agotado';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'orders'
         and column_name in ('politica_version', 'politica_aceptada_en')) <> 2 then
    raise exception 'FALLO 4 — faltan las columnas de la política aceptada en orders';
  end if;
  raise notice 'OK 4 — etiquetas de variante válidas y columnas nuevas con sus valores por defecto';
end $$;

-- 5. es_admin
do $$
declare
  v_admin uuid := (select user_id from administradores limit 1);
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if es_admin() then
    raise exception 'FALLO 5 — es_admin() es true sin sesión';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  if es_admin() then
    raise exception 'FALLO 5 — una cuenta cualquiera pasa por administradora';
  end if;

  if v_admin is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    if not es_admin() then
      raise exception 'FALLO 5 — una administradora registrada no es reconocida';
    end if;
  end if;
  perform set_config('request.jwt.claims', '', true);

  if has_function_privilege('anon', 'public.es_admin()', 'execute')
     or not has_function_privilege('authenticated', 'public.es_admin()', 'execute') then
    raise exception 'FALLO 5 — es_admin() debe poder llamarla authenticated y no anon';
  end if;
  raise notice 'OK 5 — es_admin() solo es true para las cuentas de administradores';
end $$;

-- 6. Una cuenta nueva no administra nada
do $$
declare
  v_admin   uuid := (select user_id from administradores limit 1);
  v_pedidos int  := (select count(*) from orders);
  v_vistos  int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_vistos from orders;
  if v_vistos <> 0 then
    raise exception 'FALLO 6 — una cuenta nueva ve % pedidos', v_vistos;
  end if;

  begin
    insert into categories (nombre, slug) values ('Intrusa', 'zz-v5-intrusa');
    raise exception 'FALLO 6 — una cuenta nueva creó una categoría';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from administradores;
    raise exception 'FALLO 6 — una cuenta nueva puede leer la lista de administradoras';
  exception when insufficient_privilege then null;
  end;

  update products set stock = 0 where referencia = 'ZZV5-002';
  reset role;
  if (select stock from products where referencia = 'ZZV5-002') <> 20 then
    raise exception 'FALLO 6 — una cuenta nueva cambió el stock de un producto';
  end if;

  if v_admin is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_vistos from orders;
    update products set destacado = true where referencia = 'ZZV5-002';
    reset role;
    if v_vistos <> v_pedidos or not (select destacado from products where referencia = 'ZZV5-002') then
      raise exception 'FALLO 6 — una administradora no pudo ver los pedidos o editar un producto';
    end if;
    update products set destacado = false where referencia = 'ZZV5-002';
  end if;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'OK 6 — tener sesión no basta: solo las administradoras leen pedidos y escriben';
end $$;

-- 7. cancelar_pedido suma las líneas de un mismo producto y devuelve el stock una sola vez
do $$
declare
  v_producto uuid := (select id from products where referencia = 'USK-621-ZZV5');
  v_pedido   uuid;
  v_stock    int;
begin
  insert into orders (numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad, politica_version, politica_aceptada_en)
  values ('ZZV5-0001', 'Prueba v5', '3000000000', 'Cali', '2026-11-10', now())
  returning id into v_pedido;

  insert into order_items (order_id, product_id, referencia_snapshot, nombre_snapshot, tono_snapshot,
                           cantidad, precio_unitario_aplicado, subtotal)
  values (v_pedido, v_producto, 'USK-621-ZZV5', 'USK-621 Paleta', 'Tono 1', 2, 1000, 2000),
         (v_pedido, v_producto, 'USK-621-ZZV5', 'USK-621 Paleta', 'Tono 2', 3, 1000, 3000);

  select stock into v_stock from products where id = v_producto;
  perform cancelar_pedido(v_pedido);
  if (select stock from products where id = v_producto) <> v_stock + 5 then
    raise exception 'FALLO 7 — cancelar debía devolver 5 unidades y devolvió %',
      (select stock from products where id = v_producto) - v_stock;
  end if;

  perform cancelar_pedido(v_pedido);
  if (select stock from products where id = v_producto) <> v_stock + 5 then
    raise exception 'FALLO 7 — cancelar dos veces devolvió el stock dos veces';
  end if;
  if (select estado::text from orders where id = v_pedido) <> 'cancelado' then
    raise exception 'FALLO 7 — el pedido no quedó cancelado';
  end if;

  -- Un pedido que ya estaba cancelado no devuelve nada, aunque le falte la bandera.
  insert into orders (numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad, estado)
  values ('ZZV5-0002', 'Prueba v5', '3000000000', 'Cali', 'cancelado')
  returning id into v_pedido;
  insert into order_items (order_id, product_id, referencia_snapshot, nombre_snapshot, cantidad, precio_unitario_aplicado, subtotal)
  values (v_pedido, v_producto, 'USK-621-ZZV5', 'USK-621 Paleta', 4, 1000, 4000);

  select stock into v_stock from products where id = v_producto;
  perform cancelar_pedido(v_pedido);
  if (select stock from products where id = v_producto) <> v_stock then
    raise exception 'FALLO 7 — un pedido que ya estaba cancelado devolvió stock';
  end if;
  raise notice 'OK 7 — cancelar devuelve todas las unidades de un producto con varios tonos, una sola vez';
end $$;

-- 8. cambiar_estado_pedido
do $$
declare
  v_producto uuid := (select id from products where referencia = 'ZZV5-003');
  v_pedido   uuid;
  v_stock    int;
  v_estado   text;
begin
  insert into orders (numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad)
  values ('ZZV5-0003', 'Prueba v5', '3000000000', 'Cali')
  returning id into v_pedido;
  insert into order_items (order_id, product_id, referencia_snapshot, nombre_snapshot, cantidad, precio_unitario_aplicado, subtotal)
  values (v_pedido, v_producto, 'ZZV5-003', 'Brocha para polvo', 4, 1000, 4000);

  -- Camino normal, correcciones y repetir el estado actual (doble toque).
  foreach v_estado in array array['pagado', 'enviado', 'pagado', 'nuevo', 'enviado', 'pagado', 'pagado'] loop
    perform cambiar_estado_pedido(v_pedido, v_estado);
    if (select estado::text from orders where id = v_pedido) <> v_estado then
      raise exception 'FALLO 8 — el pedido no pasó a «%»', v_estado;
    end if;
  end loop;

  perform cambiar_estado_pedido(v_pedido, 'enviado');
  begin
    perform cambiar_estado_pedido(v_pedido, 'cancelado');
    raise exception 'FALLO 8 — se canceló un pedido ya enviado';
  exception when others then
    if sqlerrm <> 'TRANSICION_INVALIDA' then raise; end if;
  end;

  perform cambiar_estado_pedido(v_pedido, 'pagado');
  select stock into v_stock from products where id = v_producto;
  perform cambiar_estado_pedido(v_pedido, 'cancelado');
  perform cambiar_estado_pedido(v_pedido, 'cancelado');
  if (select stock from products where id = v_producto) <> v_stock + 4 then
    raise exception 'FALLO 8 — cancelar desde «pagado» debía devolver 4 unidades una sola vez';
  end if;

  foreach v_estado in array array['nuevo', 'pagado', 'enviado'] loop
    begin
      perform cambiar_estado_pedido(v_pedido, v_estado);
      raise exception 'FALLO 8 — un pedido cancelado volvió a «%»', v_estado;
    exception when others then
      if sqlerrm <> 'TRANSICION_INVALIDA' then raise; end if;
    end;
  end loop;

  insert into orders (numero_pedido, cliente_nombre, cliente_whatsapp, cliente_ciudad)
  values ('ZZV5-0004', 'Prueba v5', '3000000000', 'Cali')
  returning id into v_pedido;
  insert into order_items (order_id, product_id, referencia_snapshot, nombre_snapshot, cantidad, precio_unitario_aplicado, subtotal)
  values (v_pedido, v_producto, 'ZZV5-003', 'Brocha para polvo', 1, 1000, 1000);

  foreach v_estado in array array['perdido', ''] loop
    begin
      perform cambiar_estado_pedido(v_pedido, v_estado);
      raise exception 'FALLO 8 — se aceptó el estado «%»', v_estado;
    exception when others then
      if sqlerrm <> 'TRANSICION_INVALIDA' then raise; end if;
    end;
  end loop;
  begin
    perform cambiar_estado_pedido(v_pedido, null);
    raise exception 'FALLO 8 — se aceptó un estado nulo';
  exception when others then
    if sqlerrm <> 'TRANSICION_INVALIDA' then raise; end if;
  end;

  select stock into v_stock from products where id = v_producto;
  perform cambiar_estado_pedido(v_pedido, 'cancelado');
  if (select stock from products where id = v_producto) <> v_stock + 1
     or (select estado::text from orders where id = v_pedido) <> 'cancelado' then
    raise exception 'FALLO 8 — nuevo → cancelado no devolvió el stock';
  end if;

  begin
    perform cambiar_estado_pedido(gen_random_uuid(), 'pagado');
    raise exception 'FALLO 8 — se cambió el estado de un pedido que no existe';
  exception when others then
    if sqlerrm <> 'PEDIDO_NO_ENCONTRADO' then raise; end if;
  end;

  if has_function_privilege('anon', 'public.cambiar_estado_pedido(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.cambiar_estado_pedido(uuid, text)', 'execute')
     or not has_function_privilege('service_role', 'public.cambiar_estado_pedido(uuid, text)', 'execute') then
    raise exception 'FALLO 8 — cambiar_estado_pedido debe ser solo de service_role';
  end if;
  raise notice 'OK 8 — cambiar_estado_pedido acepta solo transiciones válidas y cancelado es final';
end $$;

-- 9. Ajustes públicos
do $$
begin
  if not exists (select 1 from store_settings where clave = 'envio_info' and publico and btrim(valor) <> '') then
    raise exception 'FALLO 9 — falta el ajuste público envio_info';
  end if;
  if exists (select 1 from store_settings where clave = 'mensaje_exito' and valor ilike '%princesa%') then
    raise exception 'FALLO 9 — mensaje_exito todavía dice «princesa»';
  end if;
  raise notice 'OK 9 — envio_info existe y mensaje_exito no usa apodos';
end $$;

-- 10. Políticas y permisos
do $$
declare
  v_mal text;
begin
  select string_agg(t.tabla || '.' || t.politica, ', ') into v_mal
    from (values ('categories', 'categories_admin'), ('products', 'products_admin'),
                 ('price_tiers', 'price_tiers_admin'), ('product_shades', 'shades_admin'),
                 ('discount_rules', 'reglas_admin'), ('store_settings', 'settings_admin'),
                 ('orders', 'orders_admin'), ('order_items', 'order_items_admin'),
                 ('access_codes', 'codes_admin')) as t(tabla, politica)
   where not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = t.tabla and p.policyname = t.politica
                        and p.qual like '%es_admin()%' and p.with_check like '%es_admin()%');
  if v_mal is not null then
    raise exception 'FALLO 10 — políticas de administración sin es_admin(): %', v_mal;
  end if;

  select string_agg(tablename || '.' || policyname, ', ') into v_mal
    from pg_policies
   where schemaname in ('public', 'storage') and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true');
  if v_mal is not null then
    raise exception 'FALLO 10 — políticas de escritura abiertas a cualquier cuenta: %', v_mal;
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects' and policyname = 'productos_admin'
                    and qual like '%productos%' and qual like '%es_admin()%' and with_check like '%es_admin()%') then
    raise exception 'FALLO 10 — el bucket productos no exige es_admin() para escribir';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.administradores'::regclass)
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'administradores')
     or has_table_privilege('anon', 'public.administradores', 'select')
     or has_table_privilege('authenticated', 'public.administradores', 'select') then
    raise exception 'FALLO 10 — administradores debe tener RLS, ninguna política y ningún permiso público';
  end if;

  if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
     or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') then
    raise exception 'FALLO 10 — rls_auto_enable() sigue expuesta a anon o authenticated';
  end if;

  if not has_function_privilege('anon', 'public.buscar_productos(text[], uuid[])', 'execute') then
    raise exception 'FALLO 10 — la tienda (anon) no puede llamar buscar_productos';
  end if;
  raise notice 'OK 10 — toda escritura exige es_admin() y las funciones internas no están expuestas';
end $$;

-- 11. Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    raise exception 'FALLO 11 — orders no está en la publicación supabase_realtime';
  end if;
  raise notice 'OK 11 — Realtime publica orders: el panel ve los pedidos sin recargar';
end $$;

do $$
begin
  raise notice '=========================================';
  raise notice ' TODAS LAS PRUEBAS V5 PASARON';
  raise notice '=========================================';
end $$;

-- Nada de lo anterior se conserva.
rollback;
