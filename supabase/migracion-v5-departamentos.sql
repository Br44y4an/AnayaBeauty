-- Anaya Beauty · v5, departamentos: agrupa las 26 categorías activas en 7 departamentos (dos niveles).
-- Correr DESPUÉS de publicar la web v5: la web vieja mostraría los departamentos vacíos. Requiere migracion-v5.sql.
-- Es idempotente, solo mueve las 26 categorías de la lista (las inactivas quedan igual) y se deshace con revertir-v5.sql.

insert into public.categories (nombre, slug, orden, etiqueta_variante) values
  ('Rostro',                 'rostro',                 10, 'Tono'),
  ('Ojos y cejas',           'ojos-y-cejas',           20, 'Tono'),
  ('Labios',                 'labios',                 30, 'Tono'),
  ('Brochas y herramientas', 'brochas-y-herramientas', 40, 'Color'),
  ('Cuidado personal',       'cuidado-personal',       50, 'Color'),
  ('Cabello y peinado',      'cabello-y-peinado',      60, 'Color'),
  ('Bolsos y accesorios',    'bolsos-y-accesorios',    70, 'Color')
on conflict (slug) do nothing;

update public.categories h
   set categoria_padre_id = d.id
  from (values
         ('rostro', 'polvos-y-bases'), ('rostro', 'contornos-y-correctores'), ('rostro', 'rubores'),
         ('rostro', 'iluminadores'),
         ('ojos-y-cejas', 'sombras'), ('ojos-y-cejas', 'pestanina-y-delineadores'),
         ('ojos-y-cejas', 'pestanas-postizas'), ('ojos-y-cejas', 'cejas'),
         ('labios', 'labial-en-barra'), ('labios', 'labiales-liquidos'), ('labios', 'lip-gloss'),
         ('brochas-y-herramientas', 'brochas-y-pinceles'), ('brochas-y-herramientas', 'blenders-y-aplicadores'),
         ('brochas-y-herramientas', 'encrespadores'), ('brochas-y-herramientas', 'depiladores-y-perfiladores'),
         ('brochas-y-herramientas', 'tijeras'),
         ('cuidado-personal', 'skin-care'), ('cuidado-personal', 'manicure-y-pedicure'),
         ('cabello-y-peinado', 'cabello'), ('cabello-y-peinado', 'cepillos'),
         ('bolsos-y-accesorios', 'bolsos-y-morrales'), ('bolsos-y-accesorios', 'neceseres'),
         ('bolsos-y-accesorios', 'cosmetiqueras'), ('bolsos-y-accesorios', 'espejos'),
         ('bolsos-y-accesorios', 'gemas-facial-y-corporal'), ('bolsos-y-accesorios', 'otros-accesorios')
       ) as a(departamento, categoria)
  join public.categories d on d.slug = a.departamento
 where h.slug = a.categoria
   and h.categoria_padre_id is distinct from d.id;

-- Si la dueña creó categorías después de escribir esta lista, quedan sueltas: se avisa para ubicarlas en el panel.
do $$
declare
  v_sueltas text;
begin
  select string_agg(nombre, ', ' order by nombre) into v_sueltas
    from public.categories
   where activo and categoria_padre_id is null
     and slug not in ('rostro', 'ojos-y-cejas', 'labios', 'brochas-y-herramientas',
                      'cuidado-personal', 'cabello-y-peinado', 'bolsos-y-accesorios');
  if v_sueltas is not null then
    raise notice 'Categorías activas sin departamento: %', v_sueltas;
  end if;
end $$;
