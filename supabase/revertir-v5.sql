-- Anaya Beauty · revertir la v5: deshace solo los departamentos (las categorías vuelven a ser planas).
-- Columnas, funciones y políticas de la v5 se quedan: la web vieja funciona con ellas.
-- Un departamento con productos propios no se borra (quedarían sin categoría): se avisa para moverlos.

update public.categories h
   set categoria_padre_id = null
  from public.categories d
 where h.categoria_padre_id = d.id
   and d.slug in ('rostro', 'ojos-y-cejas', 'labios', 'brochas-y-herramientas',
                  'cuidado-personal', 'cabello-y-peinado', 'bolsos-y-accesorios');

delete from public.categories d
 where d.slug in ('rostro', 'ojos-y-cejas', 'labios', 'brochas-y-herramientas',
                  'cuidado-personal', 'cabello-y-peinado', 'bolsos-y-accesorios')
   and not exists (select 1 from public.products p where p.category_id = d.id);

do $$
declare
  v_quedan text;
begin
  select string_agg(nombre, ', ' order by orden) into v_quedan
    from public.categories
   where slug in ('rostro', 'ojos-y-cejas', 'labios', 'brochas-y-herramientas',
                  'cuidado-personal', 'cabello-y-peinado', 'bolsos-y-accesorios');
  if v_quedan is not null then
    raise notice 'No se borraron porque tienen productos propios: %', v_quedan;
  end if;
end $$;
