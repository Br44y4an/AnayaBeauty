-- =====================================================================
-- Anaya Beauty — Esquema de base de datos
-- Ejecutar PRIMERO, en el editor SQL de Supabase.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Numeración consecutiva de pedidos: AB-0001, AB-0002, ...
create sequence if not exists seq_numero_pedido start 1;

-- ---------------------------------------------------------------------
-- Categorías (admiten subcategorías vía categoria_padre_id)
-- ---------------------------------------------------------------------
create table if not exists categories (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  slug               text not null unique,
  orden              int  not null default 0,
  categoria_padre_id uuid references categories(id) on delete set null,
  activo             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists categories_padre_idx on categories (categoria_padre_id);

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  referencia        text not null unique,
  nombre            text not null,
  descripcion       text,
  category_id       uuid references categories(id) on delete set null,
  imagen_principal  text,
  galeria           text[] not null default '{}',
  stock             int  not null default 0 check (stock >= 0),
  activo            boolean not null default true,
  orden             int  not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_categoria_idx on products (category_id);
create index if not exists products_activo_idx    on products (activo);
create index if not exists products_nombre_trgm   on products using gin (nombre gin_trgm_ops);
create index if not exists products_ref_trgm      on products using gin (referencia gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Escalones de precio por cantidad
-- Ejemplo: (1, 10000), (3, 9000), (6, 8000)
-- ---------------------------------------------------------------------
create table if not exists price_tiers (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  min_cantidad     int  not null check (min_cantidad >= 1),
  precio_unitario  int  not null check (precio_unitario > 0),
  unique (product_id, min_cantidad)
);
create index if not exists price_tiers_producto_idx on price_tiers (product_id, min_cantidad desc);

-- ---------------------------------------------------------------------
-- Códigos de acceso de 4 dígitos
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_codigo as enum ('disponible', 'usado', 'anulado');
exception when duplicate_object then null; end $$;

create table if not exists access_codes (
  id          uuid primary key default gen_random_uuid(),
  code        char(4) not null check (code ~ '^[0-9]{4}$'),
  estado      estado_codigo not null default 'disponible',
  creado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  vence_en    timestamptz not null,
  usado_en    timestamptz,
  order_id    uuid,
  nota        text
);

-- Solo puede haber UN código con el mismo número entre los disponibles.
-- Los usados y anulados quedan como historial y liberan el número.
create unique index if not exists access_codes_disponible_unico
  on access_codes (code) where estado = 'disponible';
create index if not exists access_codes_estado_idx on access_codes (estado, created_at desc);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_pedido as enum ('nuevo', 'pagado', 'enviado', 'cancelado');
exception when duplicate_object then null; end $$;

create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  numero_pedido     text not null unique
                      default 'AB-' || lpad(nextval('seq_numero_pedido')::text, 4, '0'),
  code_id           uuid references access_codes(id) on delete set null,
  cliente_nombre    text not null,
  cliente_whatsapp  text not null,
  cliente_ciudad    text not null,
  total             int  not null default 0,
  estado            estado_pedido not null default 'nuevo',
  notas_admin       text,
  -- Bandera de idempotencia: evita devolver el stock dos veces
  stock_devuelto    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists orders_estado_idx on orders (estado, created_at desc);
create index if not exists orders_fecha_idx  on orders (created_at desc);

-- La referencia circular se agrega después de crear ambas tablas
do $$ begin
  alter table access_codes
    add constraint access_codes_order_fk
    foreign key (order_id) references orders(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Líneas del pedido, con datos congelados al momento de la compra
-- ---------------------------------------------------------------------
create table if not exists order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id) on delete cascade,
  product_id                uuid references products(id) on delete set null,
  referencia_snapshot       text not null,
  nombre_snapshot           text not null,
  cantidad                  int  not null check (cantidad > 0),
  precio_unitario_aplicado  int  not null,
  subtotal                  int  not null
);
create index if not exists order_items_pedido_idx on order_items (order_id);

-- ---------------------------------------------------------------------
-- Configuración editable desde el panel
-- ---------------------------------------------------------------------
create table if not exists store_settings (
  clave           text primary key,
  valor           text not null,
  publico         boolean not null default false,
  actualizado_en  timestamptz not null default now()
);

insert into store_settings (clave, valor, publico) values
  ('pago_metodo',            'Nequi',                                true),
  ('pago_titular',           'Anaya Beauty',                         true),
  ('pago_numero',            '3132553660',                           true),
  ('whatsapp_negocio',       '573132553660',                         true),
  ('mensaje_exito',          '¡Gracias por tu compra, princesa! ✨',  true),
  ('horas_vigencia_codigo',  '24',                                   false)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- Intentos fallidos de canje (para el límite de intentos)
-- Se guarda un hash con sal de la IP, nunca la IP en claro.
-- ---------------------------------------------------------------------
create table if not exists code_attempts (
  id          bigserial primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists code_attempts_idx on code_attempts (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- Mantener updated_at al día
-- ---------------------------------------------------------------------
create or replace function tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function tocar_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function tocar_updated_at();
