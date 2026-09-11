-- =====================================================================
-- Anaya Beauty — Migración v4  ·  "Pedido sin código"
--
-- QUÉ CAMBIA Y POR QUÉ
--
-- 1. SE ELIMINA EL CÓDIGO DE 4 DÍGITOS COMO REQUISITO.
--    Era un paso extra entre "ya elegí" y "ya pedí": la clienta tenía
--    que salir a WhatsApp, esperar respuesta y volver. Cada minuto de
--    esa espera es una venta que se enfría. Ahora el pedido se confirma
--    de una y el cobro se sigue haciendo a mano, igual que antes: lo
--    que desaparece es la tranca, no el control.
--
--    El código tampoco era la protección que parecía: el insert en
--    code_attempts iba seguido de raise exception, y la excepción
--    revierte la transacción entera, incluido ese insert. El límite por
--    fuerza bruta nunca llegó a contar ni un intento.
--
--    En su lugar, dos defensas que sí funcionan porque viven en filas
--    que se confirman:
--      * limite por dispositivo sobre orders.ip_hash (pedidos reales de
--        los ultimos 10 minutos);
--      * clave_idempotencia: si el mismo envio llega dos veces (doble
--        toque, reintento por senal mala), se devuelve el pedido que ya
--        existe en vez de crear otro y descontar stock dos veces.
--
--    Las tablas access_codes y code_attempts NO se borran: los pedidos
--    viejos las referencian y el historial debe quedar intacto.
--
-- 2. COLUMNAS CALCULADAS EN products (precio_desde, precio_base,
--    num_tonos), mantenidas por disparadores.
--    El catálogo no tenía forma de ordenar por precio ni de paginar en
--    la base, porque el precio vive en price_tiers: había que traer los
--    591 productos con todos sus escalones y todos sus tonos a memoria
--    para poder ordenarlos. Con estas columnas el servidor pide solo la
--    página que se va a ver.
--
-- Ejecutar en el editor SQL de Supabase DESPUÉS de migracion-v3.sql.
-- Es idempotente: se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table orders add column if not exists ip_hash            text;
alter table orders add column if not exists clave_idempotencia text;
alter table orders add column if not exists notas_cliente      text;

-- Solo una fila por clave: es lo que convierte el reintento en algo
-- seguro. Parcial, porque los pedidos viejos tienen la clave en null.
create unique index if not exists orders_idempotencia_unica
  on orders (clave_idempotencia) where clave_idempotencia is not null;

create index if not exists orders_ip_hash_idx
  on orders (ip_hash, created_at desc) where ip_hash is not null;

alter table products add column if not exists precio_desde int;
alter table products add column if not exists precio_base  int;
alter table products add column if not exists num_tonos    int not null default 0;

-- Índices para paginar y ordenar sin traer la tabla entera.
create index if not exists products_catalogo_idx
  on products (activo, orden, created_at desc);
create index if not exists products_precio_desde_idx
  on products (precio_desde) where activo = true;

-- ---------------------------------------------------------------------
-- 2. Disparadores que mantienen las columnas calculadas
-- ---------------------------------------------------------------------
create or replace function refrescar_precios_producto(p_product_id uuid)
returns void
language sql
as $func$
  update products set
    precio_desde = (select min(precio_unitario) from price_tiers where product_id = p_product_id),
    precio_base  = (select precio_unitario from price_tiers
                     where product_id = p_product_id
                     order by min_cantidad asc limit 1)
  where id = p_product_id;
$func$;

create or replace function tocar_precios_producto() returns trigger
language plpgsql as $func$
begin
  perform refrescar_precios_producto(coalesce(new.product_id, old.product_id));
  return null;
end $func$;

drop trigger if exists price_tiers_refresca_producto on price_tiers;
create trigger price_tiers_refresca_producto
  after insert or update or delete on price_tiers
  for each row execute function tocar_precios_producto();

create or replace function tocar_num_tonos() returns trigger
language plpgsql as $func$
begin
  update products
     set num_tonos = (select count(*) from product_shades
                       where product_id = coalesce(new.product_id, old.product_id))
   where id = coalesce(new.product_id, old.product_id);
  return null;
end $func$;

drop trigger if exists product_shades_cuenta on product_shades;
create trigger product_shades_cuenta
  after insert or update or delete on product_shades
  for each row execute function tocar_num_tonos();

-- Relleno inicial para los productos que ya existen.
update products p set
  precio_desde = (select min(precio_unitario) from price_tiers t where t.product_id = p.id),
  precio_base  = (select precio_unitario from price_tiers t
                   where t.product_id = p.id order by min_cantidad asc limit 1),
  num_tonos    = (select count(*) from product_shades s where s.product_id = p.id);

-- ---------------------------------------------------------------------
-- 3. crear_pedido SIN código
--
-- Se eliminan las firmas viejas primero: la nueva tendría la misma
-- aridad que la de v2/v3 y PostgreSQL no podría decidir cuál llamar.
-- ---------------------------------------------------------------------
drop function if exists crear_pedido(text, text, text, text, jsonb, text);
drop function if exists crear_pedido(text, text, text, text, jsonb);

create or replace function crear_pedido(
  p_nombre   text,
  p_whatsapp text,
  p_ciudad   text,
  p_notas    text,
  p_items    jsonb,
  p_ip_hash  text,
  p_clave    text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_producto          products%rowtype;
  v_item              jsonb;
  v_cantidad          int;
  -- Unidades de ESE producto en todo el carrito, sumando sus tonos: es
  -- la cantidad que decide el escalón, no la de la línea suelta.
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
  v_recientes         int;
  v_existente         orders%rowtype;
begin
  -- ---------- Reintento seguro ----------
  -- El mismo envío puede llegar dos veces: doble toque en el botón, o
  -- el navegador reintentando tras una señal mala. Sin esto el segundo
  -- envío crearía un pedido gemelo y descontaría el stock otra vez.
  if coalesce(trim(p_clave), '') <> '' then
    select * into v_existente from orders where clave_idempotencia = p_clave;
    if found then
      return jsonb_build_object(
        'order_id',      v_existente.id,
        'numero_pedido', v_existente.numero_pedido,
        'subtotal',      v_existente.subtotal,
        'descuento',     v_existente.descuento,
        'porcentaje',    v_existente.porcentaje_descuento,
        'por_mayor',     v_existente.por_mayor,
        'total',         v_existente.total,
        'repetido',      true
      );
    end if;
  end if;

  -- ---------- Límite por dispositivo ----------
  -- Cuenta pedidos REALES (filas ya confirmadas), no intentos: los
  -- intentos se revertían junto con la excepción que los provocaba, y
  -- por eso el límite viejo nunca contó nada.
  if coalesce(trim(p_ip_hash), '') <> '' then
    select count(*) into v_recientes
      from orders
     where ip_hash = p_ip_hash
       and created_at > now() - interval '10 minutes';

    if v_recientes >= 6 then
      raise exception 'DEMASIADOS_PEDIDOS';
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CARRITO_VACIO';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_whatsapp), '') = ''
     or coalesce(trim(p_ciudad), '') = '' then
    raise exception 'DATOS_INCOMPLETOS';
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
      raise exception 'PRODUCTO_NO_DISPONIBLE|%', coalesce(v_producto.nombre, '');
    end if;

    -- Los tonos comparten inventario y comparten escalón de precio.
    select coalesce(sum((i->>'cantidad')::int), 0)
      into v_cantidad_producto
      from jsonb_array_elements(p_items) i
     where (i->>'producto_id')::uuid = v_producto.id;

    if v_producto.stock < v_cantidad_producto then
      raise exception 'SIN_STOCK|%|%', v_producto.nombre, v_producto.stock;
    end if;

    v_precio := precio_unitario_para(v_producto.id, v_cantidad_producto);
    if v_precio is null then
      raise exception 'SIN_PRECIO|%', v_producto.nombre;
    end if;

    v_subtotal_normal := v_subtotal_normal + v_precio * v_cantidad;
  end loop;

  -- ---------- ¿Aplica precio por mayor? ----------
  -- Se decide con los precios normales y no se revierte: si se
  -- recalculara sobre el subtotal ya rebajado, oscilaría sin fin.
  select coalesce(max(valor)::int, 200000) into v_umbral
    from store_settings where clave = 'umbral_por_mayor';

  v_por_mayor := v_subtotal_normal >= v_umbral;

  -- ---------- Crear el pedido ----------
  insert into orders (
    cliente_nombre, cliente_whatsapp, cliente_ciudad,
    notas_cliente, ip_hash, clave_idempotencia
  ) values (
    trim(p_nombre), trim(p_whatsapp), trim(p_ciudad),
    nullif(trim(coalesce(p_notas, '')), ''),
    nullif(trim(coalesce(p_ip_hash, '')), ''),
    nullif(trim(coalesce(p_clave, '')), '')
  )
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

  return jsonb_build_object(
    'order_id',      v_order_id,
    'numero_pedido', v_numero,
    'subtotal',      v_subtotal_base,
    'descuento',     v_descuento,
    'porcentaje',    v_porcentaje,
    'por_mayor',     v_por_mayor,
    'total',         v_total,
    'repetido',      false
  );
end;
$func$;

revoke all on function crear_pedido(text, text, text, text, jsonb, text, text) from public;
grant execute on function crear_pedido(text, text, text, text, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. Lo que el carrito necesita, en una sola consulta
--
-- Tiene que ser SECURITY DEFINER por un motivo concreto: las políticas
-- de lectura pública solo dejan ver productos con activo = true. Si la
-- administradora oculta un producto que alguien ya tenía en su bolsa, la
-- consulta normal no devuelve NADA de esa fila — ni siquiera el nombre —
-- y el carrito solo podía hacer desaparecer la línea en silencio.
--
-- Aquí se expone lo mínimo para poder decirle a la clienta QUÉ producto
-- se cayó y por qué: nombre, foto, stock y si sigue publicado. Nada
-- sensible, y solo de los identificadores que ella ya tenía guardados.
-- ---------------------------------------------------------------------
drop function if exists disponibilidad_productos(uuid[]);

create or replace function productos_del_carrito(p_ids uuid[])
returns table (
  id               uuid,
  referencia       text,
  nombre           text,
  imagen_principal text,
  stock            int,
  activo           boolean,
  escalones        jsonb
)
language sql
security definer
stable
set search_path = public
as $func$
  select
    p.id,
    p.referencia,
    p.nombre,
    p.imagen_principal,
    p.stock,
    p.activo,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'min_cantidad',    t.min_cantidad,
                'precio_unitario', t.precio_unitario)
              order by t.min_cantidad)
         from price_tiers t where t.product_id = p.id),
      '[]'::jsonb
    ) as escalones
  from products p
  where p.id = any(p_ids);
$func$;

revoke all on function productos_del_carrito(uuid[]) from public;
grant execute on function productos_del_carrito(uuid[]) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Tonos: lectura pública
--
-- El catálogo ya no trae los tonos de los 591 productos en la consulta
-- de la grilla; los pide solo del producto cuya hoja de tonos se abre.
-- Esa consulta puntual necesita su política de lectura.
-- ---------------------------------------------------------------------
alter table product_shades enable row level security;

drop policy if exists shades_lectura_publica on product_shades;
create policy shades_lectura_publica on product_shades
  for select to anon, authenticated using (
    exists (select 1 from products p where p.id = product_shades.product_id and p.activo = true)
  );

drop policy if exists shades_admin on product_shades;
create policy shades_admin on product_shades
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 6. Cerrar las funciones de escritura al público
--
-- EL AGUJERO QUE ESTO TAPA
--
-- Supabase concede EXECUTE a `anon` y `authenticated` por defecto sobre
-- las funciones del esquema public. Ese permiso es DIRECTO, así que el
-- `revoke ... from public` de arriba NO lo quita: `crear_pedido` seguía
-- siendo llamable desde fuera con la clave anónima —la que va incrustada
-- en el navegador y cualquiera puede leer— por /rest/v1/rpc/crear_pedido.
--
-- Mientras hubo código de 4 dígitos daba igual: sin un código válido la
-- llamada no llegaba a ninguna parte. Al quitar el código la puerta quedó
-- abierta de par en par, y encima el límite por dispositivo no protege,
-- porque quien llama directo manda p_ip_hash en null y se lo salta.
-- Cualquiera podría haber creado pedidos falsos en bucle y, como cada
-- pedido descuenta inventario, dejar el catálogo en cero sin comprar nada.
--
-- El único camino público a estas funciones debe ser el server action, que
-- usa la clave de servicio y sí calcula la huella del dispositivo.
--
-- Verificable con: node --env-file=.env.local scripts/probar-seguridad.mjs
-- ---------------------------------------------------------------------
revoke execute on function crear_pedido(text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant  execute on function crear_pedido(text, text, text, text, jsonb, text, text)
  to service_role;

-- Cancelar devuelve stock al inventario: solo el panel, que va por la clave
-- de servicio tras comprobar la sesión.
revoke execute on function cancelar_pedido(uuid) from public, anon, authenticated;
grant  execute on function cancelar_pedido(uuid) to service_role;

-- En desuso desde la v4, pero seguía expuesta y escribía en la base.
revoke execute on function generar_codigo(text) from public, anon, authenticated;

-- `productos_del_carrito` SÍ sigue abierta a anon: es de solo lectura y es
-- justo lo que el carrito necesita para poder nombrar lo que se cayó.

-- ---------------------------------------------------------------------
-- 7. search_path fijo
--
-- Sin él, quien controle su propio search_path puede hacer que la función
-- resuelva una tabla distinta de la que cree estar leyendo.
-- ---------------------------------------------------------------------
alter function refrescar_precios_producto(uuid)      set search_path = public;
alter function tocar_precios_producto()              set search_path = public;
alter function tocar_num_tonos()                     set search_path = public;
alter function precio_unitario_para(uuid, int)       set search_path = public;
alter function precio_mas_bajo(uuid)                 set search_path = public;
alter function porcentaje_descuento_para(int)        set search_path = public;
alter function tocar_updated_at()                    set search_path = public;
