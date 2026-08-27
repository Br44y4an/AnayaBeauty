-- =====================================================================
-- Anaya Beauty — Migración v3
-- El escalón de precio se decide con la cantidad TOTAL del producto,
-- sumando todos sus tonos.
--
-- Antes: cada línea (producto + tono) elegía su escalón por separado, así
-- que 2 unidades de un tono + 1 de otro se cobraban las tres al precio de
-- "1 unidad" y el combo de 3 nunca se alcanzaba.
--
-- Ahora: los tonos de un producto suman entre sí para elegir el escalón,
-- igual que ya lo hacían para el stock (comparten inventario). Con
-- escalones 1→$10.000, 3→$9.000: Rojo x2 + Nude x1 = 3 unidades → las
-- tres a $9.000 = $27.000 (antes $30.000).
--
-- Lo que NO cambia: el precio por mayor se sigue decidiendo sobre el
-- subtotal del carrito completo contra `umbral_por_mayor`, y el descuento
-- por porcentaje se sigue aplicando después, sobre el subtotal ya ajustado.
--
-- Ejecutar en el editor SQL de Supabase DESPUÉS de `migracion-v2.sql`.
-- Es idempotente: si la corres dos veces no rompe nada. Solo reemplaza la
-- función `crear_pedido`; no toca tablas ni pedidos ya creados (las líneas
-- guardan el precio congelado en `order_items`).
-- =====================================================================

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
  v_code              access_codes%rowtype;
  v_producto          products%rowtype;
  v_intentos          int;
  v_item              jsonb;
  v_cantidad          int;
  -- Unidades de ESE producto en todo el carrito, sumando sus tonos.
  -- Es la cantidad que decide el escalón, no la de la línea suelta.
  v_cantidad_producto int;
  v_precio            int;
  v_subtotal_normal   int := 0;
  v_subtotal_base     int := 0;
  v_umbral            int;
  v_por_mayor         boolean := false;
  v_porcentaje        int;
  v_descuento         int;
  v_total             int;
  v_order_id          uuid;
  v_numero            text;
  v_tono              text;
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

    -- Unidades pedidas de este producto sumando TODAS sus líneas: los tonos
    -- comparten inventario y ahora también comparten escalón de precio.
    select coalesce(sum((i->>'cantidad')::int), 0)
      into v_cantidad_producto
      from jsonb_array_elements(p_items) i
     where (i->>'producto_id')::uuid = v_producto.id;

    if v_producto.stock < v_cantidad_producto then
      raise exception 'SIN_STOCK|%|%', v_producto.nombre, v_producto.stock;
    end if;

    -- El escalón se elige con el total del producto; el aporte de esta
    -- línea al subtotal es su propia cantidad a ese precio.
    v_precio := precio_unitario_para(v_producto.id, v_cantidad_producto);
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
      -- Mismo criterio que la primera pasada: el escalón lo decide el total
      -- del producto, no la cantidad de esta línea.
      select coalesce(sum((i->>'cantidad')::int), 0)
        into v_cantidad_producto
        from jsonb_array_elements(p_items) i
       where (i->>'producto_id')::uuid = v_producto.id;

      v_precio := precio_unitario_para(v_producto.id, v_cantidad_producto);
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
