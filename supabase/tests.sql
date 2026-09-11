-- =====================================================================
-- Anaya Beauty — Verificación de la lógica de negocio
--
-- ⚠️ OBSOLETO DESDE LA v4. Este archivo prueba el flujo con código de
--    acceso de 4 dígitos, que ya no existe: `crear_pedido` cambió de
--    firma y estas comprobaciones fallarán.
--
--    Usa `tests-v4.sql` en su lugar. Se conserva este archivo solo como
--    referencia de lo que se comprobaba antes.
--
-- Ejecutar CUARTO. No modifica datos: termina con rollback.
-- =====================================================================
begin;

do $$
declare
  v_cat    uuid;
  v_prod   uuid;
  v_res    jsonb;
  v_stock  int;
  v_estado estado_codigo;
  v_order  uuid;
  v_total  int;
  v_ok     boolean;
begin
  -- ---------- Datos de prueba ----------
  insert into categories (nombre, slug) values ('Prueba', 'prueba-test')
    returning id into v_cat;

  insert into products (referencia, nombre, category_id, stock)
    values ('TEST-001', 'Labial de prueba', v_cat, 10)
    returning id into v_prod;

  insert into price_tiers (product_id, min_cantidad, precio_unitario) values
    (v_prod, 1, 10000), (v_prod, 3, 9000), (v_prod, 6, 8000);

  -- ---------- 1. Motor de precios ----------
  assert precio_unitario_para(v_prod, 1) = 10000, 'precio 1 unidad';
  assert precio_unitario_para(v_prod, 2) = 10000, 'precio 2 unidades';
  assert precio_unitario_para(v_prod, 3) = 9000,  'precio 3 unidades';
  assert precio_unitario_para(v_prod, 5) = 9000,  'precio 5 unidades';
  assert precio_unitario_para(v_prod, 6) = 8000,  'precio 6 unidades';
  assert precio_unitario_para(v_prod, 99) = 8000, 'precio 99 unidades';
  raise notice 'OK 1 — motor de precios coincide con pricing.ts';

  -- ---------- 2. Pedido con código válido ----------
  insert into access_codes (code, vence_en) values ('1111', now() + interval '1 hour');

  v_res := crear_pedido('1111', 'Laura Prueba', '3001112233', 'Medellín',
             jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 3)),
             'hash-test-a');

  v_order := (v_res->>'order_id')::uuid;
  v_total := (v_res->>'total')::int;

  assert v_total = 27000, 'el total debe ser 27000, fue ' || v_total;
  assert v_res->>'numero_pedido' like 'AB-%', 'formato del número de pedido';

  select stock into v_stock from products where id = v_prod;
  assert v_stock = 7, 'el stock debe bajar de 10 a 7, quedó en ' || v_stock;

  select estado into v_estado from access_codes where code = '1111';
  assert v_estado = 'usado', 'el código debe quedar quemado';
  raise notice 'OK 2 — pedido creado, precio recalculado, stock descontado, código quemado';

  -- ---------- 3. El código no se puede reusar ----------
  v_ok := false;
  begin
    perform crear_pedido('1111', 'Otra', '3002223344', 'Cali',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-test-b');
  exception when others then
    v_ok := (sqlerrm like '%CODIGO_INVALIDO%');
  end;
  assert v_ok, 'reusar un código quemado debe fallar con CODIGO_INVALIDO';
  raise notice 'OK 3 — un código usado no sirve dos veces';

  -- ---------- 4. Código vencido ----------
  insert into access_codes (code, vence_en) values ('2222', now() - interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('2222', 'Vencida', '3003334455', 'Cali',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-test-c');
  exception when others then
    v_ok := (sqlerrm like '%CODIGO_VENCIDO%');
  end;
  assert v_ok, 'un código vencido debe ser rechazado';
  raise notice 'OK 4 — los códigos vencidos se rechazan';

  -- ---------- 5. Stock insuficiente y reversión total ----------
  insert into access_codes (code, vence_en) values ('3333', now() + interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('3333', 'Ambiciosa', '3004445566', 'Bogotá',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 999)),
              'hash-test-d');
  exception when others then
    v_ok := (sqlerrm like '%SIN_STOCK%');
  end;
  assert v_ok, 'pedir más de lo que hay debe fallar';

  select stock into v_stock from products where id = v_prod;
  assert v_stock = 7, 'tras el fallo el stock no debe moverse, quedó en ' || v_stock;

  select estado into v_estado from access_codes where code = '3333';
  assert v_estado = 'disponible', 'tras el fallo el código NO debe quemarse';
  raise notice 'OK 5 — si falla el stock, no se toca nada: ni inventario ni código';

  -- ---------- 6. Cancelación devuelve el stock ----------
  perform cancelar_pedido(v_order);
  select stock into v_stock from products where id = v_prod;
  assert v_stock = 10, 'cancelar debe devolver el stock a 10, quedó en ' || v_stock;
  raise notice 'OK 6 — cancelar un pedido devuelve el inventario';

  -- ---------- 7. Cancelar dos veces no duplica la devolución ----------
  perform cancelar_pedido(v_order);
  select stock into v_stock from products where id = v_prod;
  assert v_stock = 10, 'cancelar dos veces no debe subir el stock a 13, quedó en ' || v_stock;
  raise notice 'OK 7 — la cancelación es idempotente';

  -- ---------- 8. Límite de intentos ----------
  insert into code_attempts (ip_hash)
    select 'hash-bloqueado' from generate_series(1, 5);

  insert into access_codes (code, vence_en) values ('4444', now() + interval '1 hour');
  v_ok := false;
  begin
    perform crear_pedido('4444', 'Bot', '3005556677', 'Bogotá',
              jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1)),
              'hash-bloqueado');
  exception when others then
    v_ok := (sqlerrm like '%DEMASIADOS_INTENTOS%');
  end;
  assert v_ok, 'tras 5 intentos fallidos el dispositivo debe quedar bloqueado';
  raise notice 'OK 8 — el límite de intentos bloquea la fuerza bruta';

  -- ---------- 9. Carrito vacío ----------
  v_ok := false;
  begin
    perform crear_pedido('4444', 'Vacía', '3006667788', 'Cali',
              '[]'::jsonb, 'hash-test-e');
  exception when others then
    v_ok := (sqlerrm like '%CARRITO_VACIO%');
  end;
  assert v_ok, 'un carrito vacío debe rechazarse';
  raise notice 'OK 9 — no se aceptan pedidos vacíos';

  raise notice '=========================================';
  raise notice ' TODAS LAS PRUEBAS PASARON';
  raise notice '=========================================';
end $$;

rollback;
