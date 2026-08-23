-- =====================================================================
-- Anaya Beauty — Row Level Security
-- Ejecutar SEGUNDO, después de schema.sql
-- =====================================================================

alter table categories     enable row level security;
alter table products       enable row level security;
alter table price_tiers    enable row level security;
alter table access_codes   enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table store_settings enable row level security;
alter table code_attempts  enable row level security;

-- ---------------------------------------------------------------------
-- CATÁLOGO: lectura pública de lo que está activo
-- ---------------------------------------------------------------------
drop policy if exists categories_lectura_publica on categories;
create policy categories_lectura_publica on categories
  for select to anon, authenticated using (activo = true);

drop policy if exists products_lectura_publica on products;
create policy products_lectura_publica on products
  for select to anon, authenticated using (activo = true);

-- Los escalones son visibles solo si su producto lo es
drop policy if exists price_tiers_lectura_publica on price_tiers;
create policy price_tiers_lectura_publica on price_tiers
  for select to anon, authenticated using (
    exists (select 1 from products p where p.id = price_tiers.product_id and p.activo = true)
  );

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN: solo las claves marcadas como públicas
-- ---------------------------------------------------------------------
drop policy if exists settings_lectura_publica on store_settings;
create policy settings_lectura_publica on store_settings
  for select to anon, authenticated using (publico = true);

-- ---------------------------------------------------------------------
-- ADMINISTRACIÓN: cualquier usuario autenticado gestiona todo
-- (solo existen dos usuarios, creados a mano; no hay registro abierto)
-- ---------------------------------------------------------------------
drop policy if exists categories_admin on categories;
create policy categories_admin on categories
  for all to authenticated using (true) with check (true);

drop policy if exists products_admin on products;
create policy products_admin on products
  for all to authenticated using (true) with check (true);

drop policy if exists price_tiers_admin on price_tiers;
create policy price_tiers_admin on price_tiers
  for all to authenticated using (true) with check (true);

drop policy if exists settings_admin on store_settings;
create policy settings_admin on store_settings
  for all to authenticated using (true) with check (true);

drop policy if exists codes_admin on access_codes;
create policy codes_admin on access_codes
  for all to authenticated using (true) with check (true);

drop policy if exists orders_admin on orders;
create policy orders_admin on orders
  for all to authenticated using (true) with check (true);

drop policy if exists order_items_admin on order_items;
create policy order_items_admin on order_items
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- SIN POLÍTICA PARA anon EN:
--   access_codes  → si los códigos fueran legibles, cualquiera tendría uno gratis
--   orders        → los datos personales de las clientas no son públicos
--   order_items
--   code_attempts
-- El acceso público a estas tablas ocurre únicamente a través de las
-- funciones SECURITY DEFINER definidas en functions.sql.
-- ---------------------------------------------------------------------
