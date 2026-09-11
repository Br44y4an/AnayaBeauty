-- =====================================================================
-- Anaya Beauty — Verificación de la lógica de negocio (v4)
--
-- Reemplaza a `tests.sql`, que comprobaba el flujo con código de acceso.
-- Ejecutar en el editor SQL de Supabase DESPUÉS de `migracion-v4.sql`.
--
-- NO MODIFICA DATOS: todo ocurre dentro de una transacción que termina
-- en `rollback`. Se puede correr en producción sin miedo.
--
-- Si alguna comprobación falla, la ejecución se detiene con un mensaje
-- que dice exactamente cuál.
-- =====================================================================

begin;

do $$
declare
  v_producto  uuid;
  v_otro      uuid;
  v_res       jsonb;
  v_res2      jsonb;
  v_stock     int;
  v_umbral    int;
  v_clave     text := 'prueba-' || gen_random_uuid()::text;
  v_error     text;
begin
  -- ---------- Montaje ----------
  insert into products (referencia, nombre, stock, activo)
  values ('ZZTEST-1', 'Producto de prueba 1', 100, true)
  returning id into v_producto;

  insert into price_tiers (product_id, min_cantidad, precio_unitario) values
    (v_producto, 1, 10000),
    (v_producto, 3,  9000),
    (v_producto, 6,  8000);

  insert into products (referencia, nombre, stock, activo)
  values ('ZZTEST-2', 'Producto de prueba 2', 100, true)
  returning id into v_otro;

  insert into price_tiers (product_id, min_cantidad, precio_unitario) values
    (v_otro, 1, 20000),
    (v_otro, 3, 18000);

  -- ---------- 1. Los disparadores mantienen las columnas calculadas ----------
  select precio_desde into v_stock from products where id = v_producto;
  if v_stock is distinct from 8000 then
    raise exception 'FALLO 1 — precio_desde debería ser 8000, es %', v_stock;
  end if;
  raise notice 'OK 1 — precio_desde se mantiene solo al cambiar los escalones';

  -- ---------- 2. El motor de precios coincide con pricing.ts ----------
  if precio_unitario_para(v_producto, 1) <> 10000
     or precio_unitario_para(v_producto, 2) <> 10000
     or precio_unitario_para(v_producto, 3) <>  9000
     or precio_unitario_para(v_producto, 5) <>  9000
     or precio_unitario_para(v_producto, 6) <>  8000
     or precio_unitario_para(v_producto, 99) <> 8000 then
    raise exception 'FALLO 2 — el motor de precios no coincide con pricing.ts';
  end if;
  raise notice 'OK 2 — motor de precios coincide con pricing.ts';

  -- ---------- 3. Se puede pedir SIN código ----------
  v_res := crear_pedido(
    'Prueba', '3001112233', 'Medellín', null,
    jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 3)),
    null, null
  );

  if (v_res->>'total')::int <> 27000 then
    raise exception 'FALLO 3 — 3 unidades deberían costar 27000, cobró %', v_res->>'total';
  end if;

  select stock into v_stock from products where id = v_producto;
  if v_stock <> 97 then
    raise exception 'FALLO 3 — el stock debería ser 97, es %', v_stock;
  end if;
  raise notice 'OK 3 — el pedido se crea sin código y descuenta el stock';

  -- ---------- 4. Los tonos suman para elegir el escalón ----------
  -- Dos tonos del mismo producto comparten inventario Y escalón:
  -- 2 + 1 = 3 unidades, las tres al precio de 3.
  v_res := crear_pedido(
    'Prueba Tonos', '3001112233', 'Cali', null,
    jsonb_build_array(
      jsonb_build_object('producto_id', v_producto, 'cantidad', 2, 'tono', 'Rojo'),
      jsonb_build_object('producto_id', v_producto, 'cantidad', 1, 'tono', 'Nude')
    ),
    null, null
  );

  if (v_res->>'total')::int <> 27000 then
    raise exception 'FALLO 4 — los tonos deberían sumar para el escalón; cobró %', v_res->>'total';
  end if;
  raise notice 'OK 4 — los tonos de un producto suman para elegir el escalón';

  -- ---------- 5. Productos distintos NO suman entre sí ----------
  v_res := crear_pedido(
    'Prueba Mezcla', '3001112233', 'Bogotá', null,
    jsonb_build_array(
      jsonb_build_object('producto_id', v_producto, 'cantidad', 2),
      jsonb_build_object('producto_id', v_otro,     'cantidad', 1)
    ),
    null, null
  );

  -- 2 × 10.000 (no alcanza el escalón de 3) + 1 × 20.000 = 40.000
  if (v_res->>'total')::int <> 40000 then
    raise exception 'FALLO 5 — productos distintos no deben sumar; cobró %', v_res->>'total';
  end if;
  raise notice 'OK 5 — productos distintos no suman entre sí';

  -- ---------- 6. Reintento seguro: la misma clave no duplica ----------
  v_res := crear_pedido(
    'Prueba Doble', '3001112233', 'Cali', null,
    jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
    null, v_clave
  );

  select stock into v_stock from products where id = v_producto;

  v_res2 := crear_pedido(
    'Prueba Doble', '3001112233', 'Cali', null,
    jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
    null, v_clave
  );

  if (v_res2->>'order_id') is distinct from (v_res->>'order_id') then
    raise exception 'FALLO 6 — el reenvío creó un pedido nuevo en vez de devolver el existente';
  end if;

  if (v_res2->>'repetido')::boolean is not true then
    raise exception 'FALLO 6 — el reenvío no se marcó como repetido';
  end if;

  if (select stock from products where id = v_producto) <> v_stock then
    raise exception 'FALLO 6 — el reenvío descontó el stock por segunda vez';
  end if;
  raise notice 'OK 6 — reenviar el mismo pedido no lo duplica ni descuenta stock de nuevo';

  -- ---------- 7. El precio del navegador se ignora ----------
  v_res := crear_pedido(
    'Manipuladora', '3001112233', 'Cali', null,
    jsonb_build_array(jsonb_build_object(
      'producto_id', v_producto, 'cantidad', 1,
      'precio_unitario', 1, 'subtotal', 1)),
    null, null
  );

  if (v_res->>'total')::int <> 10000 then
    raise exception 'FALLO 7 — se hizo caso a un precio enviado por el navegador: %', v_res->>'total';
  end if;
  raise notice 'OK 7 — un precio falso enviado por el navegador se ignora';

  -- ---------- 8. Si falla el stock, no se mueve nada ----------
  select stock into v_stock from products where id = v_producto;
  begin
    v_res := crear_pedido(
      'Sin stock', '3001112233', 'Cali', null,
      jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 99999)),
      null, null
    );
    raise exception 'FALLO 8 — aceptó un pedido sin stock suficiente';
  exception when others then
    if position('SIN_STOCK' in SQLERRM) = 0 then raise; end if;
  end;

  if (select stock from products where id = v_producto) <> v_stock then
    raise exception 'FALLO 8 — el stock cambió pese a que el pedido falló';
  end if;
  raise notice 'OK 8 — si falla el stock, no se toca el inventario';

  -- ---------- 9. Datos incompletos y carrito vacío ----------
  begin
    v_res := crear_pedido('  ', '3001112233', 'Cali', null,
      jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
      null, null);
    raise exception 'FALLO 9 — aceptó un pedido sin nombre';
  exception when others then
    if position('DATOS_INCOMPLETOS' in SQLERRM) = 0 then raise; end if;
  end;

  begin
    v_res := crear_pedido('Prueba', '3001112233', 'Cali', null, '[]'::jsonb, null, null);
    raise exception 'FALLO 9 — aceptó un pedido vacío';
  exception when others then
    if position('CARRITO_VACIO' in SQLERRM) = 0 then raise; end if;
  end;
  raise notice 'OK 9 — se rechazan los pedidos vacíos o sin datos';

  -- ---------- 10. Límite por dispositivo ----------
  -- A diferencia del viejo contador de intentos, éste cuenta pedidos ya
  -- confirmados, así que la cuenta sobrevive a la excepción que la usa.
  for i in 1..6 loop
    v_res := crear_pedido(
      'Repetidora', '3001112233', 'Cali', null,
      jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
      'huella-de-prueba', null
    );
  end loop;

  begin
    v_res := crear_pedido(
      'Repetidora', '3001112233', 'Cali', null,
      jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
      'huella-de-prueba', null
    );
    raise exception 'FALLO 10 — el límite por dispositivo no frenó el séptimo pedido';
  exception when others then
    if position('DEMASIADOS_PEDIDOS' in SQLERRM) = 0 then raise; end if;
  end;
  raise notice 'OK 10 — el límite por dispositivo frena el abuso';

  -- ---------- 11. Cancelar devuelve el inventario, y es idempotente ----------
  v_res := crear_pedido(
    'Cancelable', '3001112233', 'Cali', null,
    jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 5)),
    null, null
  );

  select stock into v_stock from products where id = v_producto;
  perform cancelar_pedido((v_res->>'order_id')::uuid);

  if (select stock from products where id = v_producto) <> v_stock + 5 then
    raise exception 'FALLO 11 — cancelar no devolvió el inventario';
  end if;

  perform cancelar_pedido((v_res->>'order_id')::uuid);
  if (select stock from products where id = v_producto) <> v_stock + 5 then
    raise exception 'FALLO 11 — cancelar dos veces devolvió el stock dos veces';
  end if;
  raise notice 'OK 11 — cancelar devuelve el inventario una sola vez';

  -- ---------- 12. La nota de la clienta viaja hasta el pedido ----------
  v_res := crear_pedido(
    'Con nota', '3001112233', 'Cali', 'Es un regalo, timbre 302',
    jsonb_build_array(jsonb_build_object('producto_id', v_producto, 'cantidad', 1)),
    null, null
  );

  select notas_cliente into v_error from orders where id = (v_res->>'order_id')::uuid;
  if v_error is distinct from 'Es un regalo, timbre 302' then
    raise exception 'FALLO 12 — la nota de la clienta no se guardó: %', v_error;
  end if;
  raise notice 'OK 12 — la nota de la clienta llega hasta el pedido';

  raise notice '=========================================';
  raise notice ' TODAS LAS PRUEBAS PASARON';
  raise notice '=========================================';
end $$;

-- Nada de lo anterior se conserva.
rollback;
