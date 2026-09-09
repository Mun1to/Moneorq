-- ==========================================================
-- Moneorq en la nube: perfiles, dinero de cada persona y deudas
-- Cada fila lleva su dueño y la seguridad por filas (RLS) impide
-- que nadie vea el dinero de otro.
-- ==========================================================

-- ---------- perfiles ----------

create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default 'Mi monedero',
  emoji text not null default '💶',
  color text not null default '#2e7d5b',
  tema text not null default 'auto',
  alias text unique not null,
  creado timestamptz not null default now(),
  constraint alias_valido check (alias ~ '^[a-z0-9._-]{3,24}$')
);

-- ---------- el dinero de cada persona ----------

create table if not exists public.ingresos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references auth.users on delete cascade,
  nombre text not null,
  tipo text not null default 'nomina',
  cantidad numeric(12,2) not null check (cantidad > 0),
  dia smallint not null check (dia between 1 and 31),
  mensual boolean not null default true,
  mes text,
  desde text,
  creado timestamptz not null default now()
);

create table if not exists public.fijos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references auth.users on delete cascade,
  nombre text not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  dia smallint not null check (dia between 1 and 31),
  categoria text not null default 'otros',
  periodicidad text not null default 'mensual' check (periodicidad in ('mensual', 'anual')),
  fin text,
  desde text,
  creado timestamptz not null default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references auth.users on delete cascade,
  cantidad numeric(12,2) not null check (cantidad > 0),
  categoria text not null default 'otros',
  nota text not null default '',
  fecha date not null,
  creado timestamptz not null default now()
);

-- ---------- deudas entre personas ----------

create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  acreedor uuid not null references auth.users on delete cascade,
  deudor uuid not null references auth.users on delete cascade,
  concepto text not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  fecha date not null default current_date,
  pagada boolean not null default false,
  creado timestamptz not null default now(),
  constraint no_te_debes_a_ti_mismo check (acreedor <> deudor)
);

create index if not exists gastos_por_usuario on public.gastos (usuario, fecha);
create index if not exists deudas_por_acreedor on public.deudas (acreedor);
create index if not exists deudas_por_deudor on public.deudas (deudor);

-- ---------- seguridad por filas ----------

alter table public.perfiles enable row level security;
alter table public.ingresos enable row level security;
alter table public.fijos    enable row level security;
alter table public.gastos   enable row level security;
alter table public.deudas   enable row level security;

drop policy if exists "mi perfil y el de quien comparte deuda conmigo" on public.perfiles;
create policy "mi perfil y el de quien comparte deuda conmigo" on public.perfiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.deudas d
      where (d.acreedor = (select auth.uid()) and d.deudor = public.perfiles.id)
         or (d.deudor   = (select auth.uid()) and d.acreedor = public.perfiles.id)
    )
  );

drop policy if exists "solo edito mi perfil" on public.perfiles;
create policy "solo edito mi perfil" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- lo mismo para las tres tablas de dinero: cada quien lo suyo y nada más
do $$
declare t text;
begin
  foreach t in array array['ingresos', 'fijos', 'gastos'] loop
    execute format('drop policy if exists "solo lo mio" on public.%I', t);
    execute format(
      'create policy "solo lo mio" on public.%I for all to authenticated
         using (usuario = (select auth.uid())) with check (usuario = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "veo las deudas que me tocan" on public.deudas;
create policy "veo las deudas que me tocan" on public.deudas
  for select to authenticated
  using (acreedor = (select auth.uid()) or deudor = (select auth.uid()));

drop policy if exists "apunto deudas donde salgo yo" on public.deudas;
create policy "apunto deudas donde salgo yo" on public.deudas
  for insert to authenticated
  with check (acreedor = (select auth.uid()) or deudor = (select auth.uid()));

drop policy if exists "marco pagada la deuda que me toca" on public.deudas;
create policy "marco pagada la deuda que me toca" on public.deudas
  for update to authenticated
  using (acreedor = (select auth.uid()) or deudor = (select auth.uid()))
  with check (acreedor = (select auth.uid()) or deudor = (select auth.uid()));

drop policy if exists "borro la deuda que yo apunte" on public.deudas;
create policy "borro la deuda que yo apunte" on public.deudas
  for delete to authenticated
  using (acreedor = (select auth.uid()) or deudor = (select auth.uid()));

-- ---------- perfil automático al crear la cuenta ----------

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_base text;
  v_alias text;
  v_intento int := 0;
begin
  v_base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9._-]', '', 'g'));
  if length(v_base) < 3 then v_base := 'persona'; end if;
  v_base := left(v_base, 18);
  v_alias := v_base;

  while exists (select 1 from public.perfiles p where p.alias = v_alias) loop
    v_intento := v_intento + 1;
    v_alias := v_base || '-' || v_intento::text;
  end loop;

  insert into public.perfiles (id, alias) values (new.id, v_alias);
  return new;
end;
$fn$;

drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- ---------- buscar a una persona por su alias ----------
-- Devuelve solo id y nombre, y solo con el alias exacto: nadie puede
-- listar usuarios ni descubrir correos de nadie.

create or replace function public.buscar_persona(p_alias text)
returns table (id uuid, nombre text, alias text)
language sql
security definer
set search_path = public, pg_temp
as $fn$
  select p.id, p.nombre, p.alias
  from public.perfiles p
  where p.alias = lower(trim(p_alias))
    and p.id <> (select auth.uid())
  limit 1;
$fn$;

-- ---------- permisos ----------
-- La opción "exponer tablas nuevas automáticamente" está desactivada en este
-- proyecto, así que los permisos se dan aquí a mano y solo a quien ha entrado.

grant usage on schema public to anon, authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.ingresos to authenticated;
grant select, insert, update, delete on public.fijos    to authenticated;
grant select, insert, update, delete on public.gastos   to authenticated;
grant select, insert, update, delete on public.deudas   to authenticated;

revoke all on function public.buscar_persona(text) from public, anon;
grant execute on function public.buscar_persona(text) to authenticated;

-- ---------- tiempo real ----------
-- Para que lo que se apunta en el móvil aparezca solo en el ordenador.

do $$
declare t text;
begin
  foreach t in array array['ingresos', 'fijos', 'gastos', 'deudas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
