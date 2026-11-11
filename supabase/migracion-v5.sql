-- Anaya Beauty · migración v5 (rediseño). Compatible con la web v4: no borra nada; agrega columnas y funciones
-- y restringe la escritura a las administradoras.
-- Correr después de migracion-v4.sql y comprobar con tests-v5.sql. Es idempotente y no borra nada.
-- Los departamentos van aparte (migracion-v5-departamentos.sql), después de publicar la web v5.

-- 1. Columnas nuevas
alter table public.categories add column if not exists etiqueta_variante text
  constraint categories_etiqueta_variante_valida
  check (etiqueta_variante in ('Tono', 'Color', 'Diseño', 'Modelo', 'Aroma', 'Largo', 'Paleta'));
alter table public.products add column if not exists etiqueta_variante text
  constraint products_etiqueta_variante_valida
  check (etiqueta_variante in ('Tono', 'Color', 'Diseño', 'Modelo', 'Aroma', 'Largo', 'Paleta'));
alter table public.products       add column if not exists destacado boolean not null default false;
alter table public.product_shades add column if not exists agotado boolean not null default false;
alter table public.orders         add column if not exists politica_version text;
alter table public.orders         add column if not exists politica_aceptada_en timestamptz;

-- 2. Categorías de dos niveles como máximo: departamento y categoría
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.categories'::regclass and conname = 'categories_no_es_su_madre') then
    alter table public.categories add constraint categories_no_es_su_madre
      check (categoria_padre_id is distinct from id);
  end if;
end $$;

create or replace function public.validar_dos_niveles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.categoria_padre_id is not null and (
       exists (select 1 from public.categories where id = new.categoria_padre_id and categoria_padre_id is not null)
    or exists (select 1 from public.categories where categoria_padre_id = new.id)) then
    raise exception 'CATEGORIA_PROFUNDIDAD';
  end if;
  return new;
end $$;

create or replace trigger categories_dos_niveles
  before insert or update of categoria_padre_id on public.categories
  for each row execute function public.validar_dos_niveles();

-- 3. Búsqueda sin tildes, en cualquier orden y por referencia compacta
create or replace function public.normalizar(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(t), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')
$$;

-- Coincide si cada grupo («alt1|alt2», máx. 8) tiene alguna alternativa en el texto del producto o en su
-- referencia sin separadores («usk621» → USK-621). p_categorias incluye las hijas de cada categoría.
create or replace function public.buscar_productos(p_grupos text[], p_categorias uuid[] default null)
returns setof public.products
language sql stable security invoker set search_path = '' as $$
  with alternativas as (
    select g.n as grupo, btrim(a.alternativa) as alternativa
      from unnest(p_grupos[1:8]) with ordinality as g(texto, n)
     cross join lateral unnest((string_to_array(public.normalizar(left(g.texto, 120)), '|'))[1:10]) as a(alternativa)
     where btrim(a.alternativa) <> ''
  )
  select p.*
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.categories d on d.id = c.categoria_padre_id
   cross join lateral (
     select public.normalizar(concat_ws(' ', p.nombre, p.referencia, p.descripcion, c.nombre, d.nombre,
              (select string_agg(s.nombre, ' ') from public.product_shades s where s.product_id = p.id))) as texto,
            regexp_replace(public.normalizar(p.referencia), '[^a-z0-9]', '', 'g') as compacta
   ) b
   where p.activo
     and (p_categorias is null or p.category_id = any (p_categorias) or c.categoria_padre_id = any (p_categorias))
     and not exists (
       select 1 from (select distinct grupo from alternativas) g
        where not exists (select 1 from alternativas a
                           where a.grupo = g.grupo
                             and (strpos(b.texto, a.alternativa) > 0 or strpos(b.compacta, a.alternativa) > 0)))
$$;

grant execute on function public.normalizar(text) to anon, authenticated;
grant execute on function public.buscar_productos(text[], uuid[]) to anon, authenticated;

-- 4. Ajustes de la tienda
insert into public.store_settings (clave, valor, publico)
values ('envio_info', 'El envío se coordina por WhatsApp después de confirmar tu pedido.', true)
on conflict (clave) do nothing;

update public.store_settings
   set valor = 'Gracias por comprar en Anaya Beauty.', actualizado_en = now()
 where clave = 'mensaje_exito' and valor ilike '%princesa%';

-- 5. Administradoras: tener sesión ya no basta para escribir
create table if not exists public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.administradores enable row level security;
revoke all on table public.administradores from anon, authenticated;

-- Arranque: solo con la tabla vacía (la primera vez) y solo cuentas confirmadas. Volver a correr la
-- migración no le da acceso a nadie más; las siguientes administradoras se agregan a mano (README).
insert into public.administradores (user_id)
select u.id
  from auth.users u
 where u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous, false)
   and not exists (select 1 from public.administradores)
on conflict (user_id) do nothing;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administradores where user_id = (select auth.uid()))
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- Las políticas *_admin (for all to authenticated) cambian «cualquier sesión» por es_admin().
alter policy categories_admin  on public.categories     using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy products_admin    on public.products       using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy price_tiers_admin on public.price_tiers    using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy shades_admin      on public.product_shades using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy reglas_admin      on public.discount_rules using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy settings_admin    on public.store_settings using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy orders_admin      on public.orders         using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy order_items_admin on public.order_items    using ((select public.es_admin())) with check ((select public.es_admin()));
alter policy codes_admin       on public.access_codes   using ((select public.es_admin())) with check ((select public.es_admin()));

-- Fotos: «for all» porque Storage también pide SELECT para reemplazar o borrar. La tienda no pasa por aquí
-- (el bucket es público y sirve las fotos por URL). Las políticas que daba el README viejo se endurecen igual.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'productos_admin') then
    create policy productos_admin on storage.objects for all to authenticated
      using (bucket_id = 'productos' and (select public.es_admin()))
      with check (bucket_id = 'productos' and (select public.es_admin()));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'productos_escritura') then
    alter policy productos_escritura on storage.objects
      with check (bucket_id = 'productos' and (select public.es_admin()));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'productos_borrado') then
    alter policy productos_borrado on storage.objects
      using (bucket_id = 'productos' and (select public.es_admin()));
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 6. Cancelar devuelve el stock de todas las líneas, una sola vez
create or replace function public.cancelar_pedido(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pedido public.orders%rowtype;
begin
  select * into v_pedido from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  -- Suma por producto: con dos tonos del mismo producto, el UPDATE ... FROM línea por línea de la v4
  -- aplicaba solo una de las líneas.
  if v_pedido.estado <> 'cancelado' and not v_pedido.stock_devuelto then
    update public.products p
       set stock = p.stock + l.unidades
      from (select product_id, sum(cantidad)::int as unidades
              from public.order_items
             where order_id = p_order_id and product_id is not null
             group by product_id) l
     where p.id = l.product_id;
  end if;

  update public.orders
     set estado = 'cancelado', stock_devuelto = true
   where id = p_order_id and estado <> 'cancelado';
end $$;

revoke execute on function public.cancelar_pedido(uuid) from public, anon, authenticated;
grant execute on function public.cancelar_pedido(uuid) to service_role;

-- 7. Estados del pedido: solo transiciones válidas
create or replace function public.cambiar_estado_pedido(p_order_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actual text;
begin
  select estado::text into v_actual from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  -- Repetir el estado actual (doble toque en el panel) no es un error. Cancelado es final.
  if p_estado = v_actual then
    return;
  end if;
  if v_actual || '>' || coalesce(p_estado, '') <> all (array[
       'nuevo>pagado', 'nuevo>enviado', 'nuevo>cancelado',
       'pagado>enviado', 'pagado>nuevo', 'pagado>cancelado',
       'enviado>pagado']) then
    raise exception 'TRANSICION_INVALIDA' using detail = v_actual || ' -> ' || coalesce(p_estado, 'null');
  end if;

  if p_estado = 'cancelado' then
    perform public.cancelar_pedido(p_order_id);
  else
    update public.orders set estado = p_estado::public.estado_pedido where id = p_order_id;
  end if;
end $$;

revoke execute on function public.cambiar_estado_pedido(uuid, text) from public, anon, authenticated;
grant execute on function public.cambiar_estado_pedido(uuid, text) to service_role;

-- 8. Realtime: el panel recibe los pedidos nuevos sin recargar
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
