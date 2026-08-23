-- =====================================================================
-- Anaya Beauty — Funciones de negocio
-- Ejecutar TERCERO, después de policies.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Motor de precios, versión PostgreSQL.
-- Debe coincidir exactamente con src/lib/pricing.ts.
-- Toma el escalón más alto cuyo mínimo no supere la cantidad; si la
-- cantidad queda por debajo de todos, usa el escalón más bajo.
-- ---------------------------------------------------------------------
create or replace function precio_unitario_para(p_product_id uuid, p_cantidad int)
returns int
language sql
stable
as $$
  select coalesce(
    (select precio_unitario from price_tiers
      where product_id = p_product_id and min_cantidad <= p_cantidad
      order by min_cantidad desc limit 1),
    (select precio_unitario from price_tiers
      where product_id = p_product_id
      order by min_cantidad asc limit 1)
  );
$$;

-- ---------------------------------------------------------------------
-- crear_pedido: valida el código, verifica stock, recalcula precios,
-- descuenta inventario, guarda el pedido y quema el código.
-- Todo o nada.
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
  v_code     access_codes%rowtype;
  v_producto products%rowtype;
  v_intentos int;
  v_item     jsonb;
  v_cantidad int;
  v_precio   int;
  v_subtotal int;
  v_total    int := 0;
  v_order_id uuid;
  v_numero   text;
begin
  -- Límite de intentos: 5 fallos por dispositivo cada 10 minutos.
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

  -- Bloquea el código: si dos clientas envían el mismo código a la vez,
  -- la segunda espera aquí y luego lo encuentra ya usado.
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

  insert into orders (code_id, cliente_nombre, cliente_whatsapp, cliente_ciudad)
  values (v_code.id, trim(p_nombre), trim(p_whatsapp), trim(p_ciudad))
  returning id, numero_pedido into v_order_id, v_numero;

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

    if v_producto.stock < v_cantidad then
      raise exception 'SIN_STOCK|%|%', v_producto.nombre, v_producto.stock;
    end if;

    -- El precio SIEMPRE sale de la base de datos, nunca del navegador.
    v_precio := precio_unitario_para(v_producto.id, v_cantidad);
    if v_precio is null then
      raise exception 'SIN_PRECIO';
    end if;

    v_subtotal := v_precio * v_cantidad;
    v_total    := v_total + v_subtotal;

    update products
       set stock = stock - v_cantidad
     where id = v_producto.id;

    insert into order_items (
      order_id, product_id, referencia_snapshot, nombre_snapshot,
      cantidad, precio_unitario_aplicado, subtotal
    ) values (
      v_order_id, v_producto.id, v_producto.referencia, v_producto.nombre,
      v_cantidad, v_precio, v_subtotal
    );
  end loop;

  update orders set total = v_total where id = v_order_id;

  update access_codes
     set estado = 'usado', usado_en = now(), order_id = v_order_id
   where id = v_code.id;

  return jsonb_build_object(
    'order_id',      v_order_id,
    'numero_pedido', v_numero,
    'total',         v_total
  );
end;
$$;

revoke all on function crear_pedido(text, text, text, text, jsonb, text) from public;
grant execute on function crear_pedido(text, text, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- cancelar_pedido: devuelve el stock. Idempotente.
-- ---------------------------------------------------------------------
create or replace function cancelar_pedido(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  -- La bandera stock_devuelto hace que cancelar dos veces no duplique
  -- la devolución de inventario.
  if not v_order.stock_devuelto then
    update products p
       set stock = p.stock + oi.cantidad
      from order_items oi
     where oi.order_id = p_order_id
       and oi.product_id = p.id;

    update orders set stock_devuelto = true where id = p_order_id;
  end if;

  update orders set estado = 'cancelado' where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- generar_codigo: crea un código de 4 dígitos único entre los activos.
-- ---------------------------------------------------------------------
create or replace function generar_codigo(p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    char(4);
  v_horas   int;
  v_vence   timestamptz;
  v_intento int := 0;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  select coalesce(max(valor)::int, 24) into v_horas
    from store_settings where clave = 'horas_vigencia_codigo';

  v_vence := now() + make_interval(hours => v_horas);

  loop
    v_intento := v_intento + 1;
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

    begin
      insert into access_codes (code, creado_por, vence_en, nota)
      values (v_code, auth.uid(), v_vence, p_nota);
      return jsonb_build_object('code', v_code, 'vence_en', v_vence);
    exception when unique_violation then
      if v_intento > 100 then
        raise exception 'NO_HAY_CODIGOS_LIBRES';
      end if;
    end;
  end loop;
end;
$$;
