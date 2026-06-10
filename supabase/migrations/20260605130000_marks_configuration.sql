-- Global marks limits (CIA/ESE max/min, totals) — single active configuration row.

create table if not exists public.marks_configuration (
  id uuid primary key default gen_random_uuid(),
  cia_max_marks_theory numeric not null default 40 check (cia_max_marks_theory > 0),
  cia_max_marks_practical numeric not null default 40 check (cia_max_marks_practical > 0),
  cia_min_marks_theory numeric not null default 16 check (cia_min_marks_theory >= 0),
  cia_min_marks_practical numeric not null default 16 check (cia_min_marks_practical >= 0),
  ese_max_marks_theory numeric not null default 60 check (ese_max_marks_theory > 0),
  ese_max_marks_practical numeric not null default 60 check (ese_max_marks_practical > 0),
  ese_min_marks_theory numeric not null default 24 check (ese_min_marks_theory >= 0),
  ese_min_marks_practical numeric not null default 24 check (ese_min_marks_practical >= 0),
  total_marks_theory numeric not null default 100 check (total_marks_theory > 0),
  total_marks_practical numeric not null default 100 check (total_marks_practical > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Enforce a single configuration row for the whole system.
create unique index if not exists marks_configuration_singleton_idx
  on public.marks_configuration ((true));

insert into public.marks_configuration (
  cia_max_marks_theory,
  cia_max_marks_practical,
  cia_min_marks_theory,
  cia_min_marks_practical,
  ese_max_marks_theory,
  ese_max_marks_practical,
  ese_min_marks_theory,
  ese_min_marks_practical,
  total_marks_theory,
  total_marks_practical
)
select 40, 40, 16, 16, 60, 60, 24, 24, 100, 100
where not exists (select 1 from public.marks_configuration);

alter table public.marks_configuration enable row level security;

grant select, insert, update on public.marks_configuration to authenticated;

create policy "marks_configuration_select_authenticated"
  on public.marks_configuration
  for select
  to authenticated
  using (true);

create policy "marks_configuration_insert_head_of_coe"
  on public.marks_configuration
  for insert
  to authenticated
  with check (public.portal_profiles_is_head_of_coe());

create policy "marks_configuration_update_head_of_coe"
  on public.marks_configuration
  for update
  to authenticated
  using (public.portal_profiles_is_head_of_coe())
  with check (public.portal_profiles_is_head_of_coe());
