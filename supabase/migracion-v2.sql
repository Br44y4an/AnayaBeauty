-- =====================================================================
-- Anaya Beauty — Migración v2
-- Tonos de color, precio por mayor y descuentos por monto.
--
-- Ejecutar UNA VEZ en el editor SQL de Supabase.
-- Es idempotente: si la corres dos veces no rompe nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tonos de color por producto
-- ---------------------------------------------------------------------
create table if not exists product_shades (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  nombre      text not null,
  color_hex   text not null default '#E5308A' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  orden       int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (product_id, nombre)
);
create index if not exists product_shades_producto_idx on product_shades (product_id, orden);

-- El tono elegido se congela en la línea del pedido, igual que el nombre
-- y el precio: renombrar un tono después no altera el historial.
alter table order_items add column if not exists tono_snapshot text;

-- ---------------------------------------------------------------------
-- 2. Reglas de descuento por monto
-- ---------------------------------------------------------------------
create table if not exists discount_rules (
  id            uuid primary key default gen_random_uuid(),
  monto_minimo  int  not null check (monto_minimo > 0),
  porcentaje    int  not null check (porcentaje > 0 and porcentaje <= 100),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (monto_minimo)
);

insert into discount_rules (monto_minimo, porcentaje) values (50000, 5)
on conflict (monto_minimo) do nothing;

-- ---------------------------------------------------------------------
-- 3. Desglose del cobro en el pedido
-- ---------------------------------------------------------------------
alter table orders add column if not exists subtotal int not null default 0;
alter table orders add column if not exists descuento int not null default 0;
alter table orders add column if not exists porcentaje_descuento int not null default 0;
alter table orders add column if not exists por_mayor boolean not null default false;

-- ---------------------------------------------------------------------
-- 4. Ajustes: umbral del por mayor y datos de pago por llave
-- ---------------------------------------------------------------------
insert into store_settings (clave, valor, publico) values
  ('umbral_por_mayor', '200000', true)
on conflict (clave) do nothing;

update store_settings set valor = 'Llave',                  actualizado_en = now() where clave = 'pago_metodo';
update store_settings set valor = '@RP3228813646',          actualizado_en = now() where clave = 'pago_numero';
update store_settings set valor = 'A** Ma** Sar** Rod***',  actualizado_en = now() where clave = 'pago_titular';
update store_settings set valor = '573228813646',           actualizado_en = now() where clave = 'whatsapp_negocio';

-- ---------------------------------------------------------------------
-- 5. Seguridad de las tablas nuevas
-- ---------------------------------------------------------------------
alter table product_shades enable row level security;
alter table discount_rules enable row level security;

-- Los tonos son visibles si su producto lo es
drop policy if exists shades_lectura_publica on product_shades;
create policy shades_lectura_publica on product_shades
  for select to anon, authenticated using (
    exists (select 1 from products p where p.id = product_shades.product_id and p.activo = true)
  );

drop policy if exists shades_admin on product_shades;
create policy shades_admin on product_shades
  for all to authenticated using (true) with check (true);

-- Las reglas activas son públicas: la clienta debe poder ver su descuento
drop policy if exists reglas_lectura_publica on discount_rules;
create policy reglas_lectura_publica on discount_rules
  for select to anon, authenticated using (activo = true);

drop policy if exists reglas_admin on discount_rules;
create policy reglas_admin on discount_rules
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 6. Funciones auxiliares del motor de precios
-- ---------------------------------------------------------------------

/** El precio unitario más bajo configurado para un producto. */
create or replace function precio_mas_bajo(p_product_id uuid)
returns int
language sql
stable
as $$
  select min(precio_unitario) from price_tiers where product_id = p_product_id;
$$;

/** El porcentaje de la regla activa de mayor monto que alcanza el subtotal. */
create or replace function porcentaje_descuento_para(p_monto int)
returns int
language sql
stable
as $$
  select coalesce(
    (select porcentaje from discount_rules
      where activo = true and monto_minimo <= p_monto
      order by monto_minimo desc
      limit 1),
    0
  );
$$;

-- ---------------------------------------------------------------------
-- 7. crear_pedido v2: tonos, precio por mayor y descuento en cascada
-- ---------------------------------------------------------------------
create or replace function crear_pedido(
  p_codigo   text,
  p_nombre   text,
  p_whatsapp text,
  p_ciudad   text,
  p_items    jsonb,
  p_ip_hash  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code            access_codes%rowtype;
  v_producto        products%rowtype;
  v_intentos        int;
  v_item            jsonb;
  v_cantidad        int;
  v_precio          int;
  v_subtotal_normal int := 0;
  v_subtotal_base   int := 0;
  v_umbral          int;
  v_por_mayor       boolean := false;
  v_porcentaje      int;
  v_descuento       int;
  v_total           int;
  v_order_id        uuid;
  v_numero          text;
  v_tono            text;
begin
  -- ---------- Límite de intentos ----------
  select count(*) into v_intentos
    from code_attempts
   where ip_hash = p_ip_hash
     and created_at > now() - interval '10 minutes';

  if v_intentos >= 5 then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_whatsapp), '') = ''
     or coalesce(trim(p_ciudad), '') = '' then
    raise exception 'DATOS_INCOMPLETOS';
  end if;

  -- ---------- Código ----------
  select * into v_code
    from access_codes
   where code = p_codigo and estado = 'disponible'
   for update;

  if not found then
    insert into code_attempts (ip_hash) values (p_ip_hash);
    raise exception 'CODIGO_INVALIDO';
  end if;

  if v_code.vence_en <= now() then
    insert into code_attempts (ip_hash) values (p_ip_hash);
    raise exception 'CODIGO_VENCIDO';
  end if;

  -- ---------- Primera pasada: validar y calcular el subtotal normal ----------
  -- Se bloquean los productos aquí; el bloqueo dura toda la transacción.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::int;

    if v_cantidad is null or v_cantidad < 1 then
      raise exception 'CANTIDAD_INVALIDA';
    end if;

    select * into v_producto
      from products
     where id = (v_item->>'producto_id')::uuid
     for update;

    if not found or not v_producto.activo then
      raise exception 'PRODUCTO_NO_DISPONIBLE';
    end if;

    -- El stock se compara contra el total pedido de ese producto sumando
    -- todas sus líneas, porque varios tonos comparten el mismo inventario.
    if v_producto.stock < (
         select coalesce(sum((i->>'cantidad')::int), 0)
           from jsonb_array_elements(p_items) i
          where (i->>'producto_id')::uuid = v_producto.id
       ) then
      raise exception 'SIN_STOCK|%|%', v_producto.nombre, v_producto.stock;
    end if;

    v_precio := precio_unitario_para(v_producto.id, v_cantidad);
    if v_precio is null then
      raise exception 'SIN_PRECIO';
    end if;

    v_subtotal_normal := v_subtotal_normal + v_precio * v_cantidad;
  end loop;

  -- ---------- ¿Aplica precio por mayor? ----------
  -- Se decide con los precios normales y no se revierte: si se recalculara
  -- después de bajar los precios, el resultado oscilaría sin fin.
  select coalesce(max(valor)::int, 200000) into v_umbral
    from store_settings where clave = 'umbral_por_mayor';

  v_por_mayor := v_subtotal_normal >= v_umbral;

  -- ---------- Crear el pedido ----------
  insert into orders (code_id, cliente_nombre, cliente_whatsapp, cliente_ciudad)
  values (v_code.id, trim(p_nombre), trim(p_whatsapp), trim(p_ciudad))
  returning id, numero_pedido into v_order_id, v_numero;

  -- ---------- Segunda pasada: precios finales, stock y líneas ----------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::int;
    v_tono     := nullif(trim(coalesce(v_item->>'tono', '')), '');

    select * into v_producto from products
     where id = (v_item->>'producto_id')::uuid;

    if v_por_mayor then
      v_precio := precio_mas_bajo(v_producto.id);
    else
      v_precio := precio_unitario_para(v_producto.id, v_cantidad);
    end if;

    v_subtotal_base := v_subtotal_base + v_precio * v_cantidad;

    update products
       set stock = stock - v_cantidad
     where id = v_producto.id;

    insert into order_items (
      order_id, product_id, referencia_snapshot, nombre_snapshot, tono_snapshot,
      cantidad, precio_unitario_aplicado, subtotal
    ) values (
      v_order_id, v_producto.id, v_producto.referencia, v_producto.nombre, v_tono,
      v_cantidad, v_precio, v_precio * v_cantidad
    );
  end loop;

  -- ---------- Descuento por monto sobre el subtotal ya ajustado ----------
  v_porcentaje := porcentaje_descuento_para(v_subtotal_base);
  v_descuento  := round(v_subtotal_base * v_porcentaje / 100.0);
  v_total      := v_subtotal_base - v_descuento;

  update orders
     set subtotal             = v_subtotal_base,
         descuento            = v_descuento,
         porcentaje_descuento = v_porcentaje,
         por_mayor            = v_por_mayor,
         total                = v_total
   where id = v_order_id;

  update access_codes
     set estado = 'usado', usado_en = now(), order_id = v_order_id
   where id = v_code.id;

  return jsonb_build_object(
    'order_id',      v_order_id,
    'numero_pedido', v_numero,
    'subtotal',      v_subtotal_base,
    'descuento',     v_descuento,
    'porcentaje',    v_porcentaje,
    'por_mayor',     v_por_mayor,
    'total',         v_total
  );
end;
$$;

revoke all on function crear_pedido(text, text, text, text, jsonb, text) from public;
grant execute on function crear_pedido(text, text, text, text, jsonb, text) to service_role;
