-- Portal labels: admin_1 (was faculty), admin_2 (was admin), head_of_coe (was super_admin).
-- Adds Supabase Auth linkage via portal_profiles; removes plaintext passwords from public tables.
-- Requires 20260505120000_portal_type_enum_new_values.sql to have committed first.

-- 1) Migrate existing rows to new labels
update public.portal_notifications
set recipient_portal = 'head_of_coe'
where recipient_portal::text = 'super_admin';

update public.portal_notifications
set sender_portal = 'head_of_coe'
where sender_portal::text = 'super_admin';

update public.portal_notifications
set recipient_portal = 'admin_1'
where recipient_portal::text = 'faculty';

update public.portal_notifications
set sender_portal = 'admin_1'
where sender_portal::text = 'faculty';

update public.portal_notifications
set recipient_portal = 'admin_2'
where recipient_portal::text = 'admin';

update public.portal_notifications
set sender_portal = 'admin_2'
where sender_portal::text = 'admin';

update public.portal_admins
set portal = 'admin_1'::public.portal_type
where portal::text = 'faculty';

update public.portal_admins
set portal = 'admin_2'::public.portal_type
where portal::text = 'admin';

update public.portal_admins
set portal = 'head_of_coe'::public.portal_type
where portal::text = 'super_admin';

-- 2) Link table for Supabase Auth users (replaces password checks on portal_admins over time)
create table if not exists public.portal_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  portal public.portal_type not null,
  email text not null,
  student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint portal_profiles_pkey primary key (user_id),
  constraint portal_profiles_student_id_key unique (student_id)
);

create index if not exists portal_profiles_portal_idx on public.portal_profiles (portal);

alter table public.students
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

comment on table public.portal_profiles is
  'Maps auth.users to portal role. Created via sign-up metadata (portal) or manual insert.';

-- 3) Auto-create profile row when Auth user signs up with raw_user_meta_data.portal
create or replace function public.handle_new_user_portal_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.raw_user_meta_data is not null
     and (new.raw_user_meta_data ? 'portal') then
    insert into public.portal_profiles (user_id, portal, email)
    values (
      new.id,
      (new.raw_user_meta_data->>'portal')::public.portal_type,
      coalesce(new.email, '')
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_portal_profile on auth.users;
create trigger on_auth_user_created_portal_profile
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user_portal_profile();

-- 4) Student links their login email to students row
create or replace function public.link_student_auth_user()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.students s
  set auth_user_id = auth.uid()
  from auth.users u
  where s.auth_user_id is null
    and u.id = auth.uid()
    and lower(s.email) = lower(u.email);
end;
$$;

grant execute on function public.link_student_auth_user() to authenticated;

-- 5) Drop plaintext passwords (use Supabase Auth only)
alter table public.students drop column if exists password;
alter table public.portal_admins drop column if exists password;

-- Legacy portal_admins rows cannot authenticate without Auth — table removed; use portal_profiles + auth.users
drop table if exists public.portal_admins cascade;

-- 6) RLS for portal_profiles
alter table public.portal_profiles enable row level security;

drop policy if exists "portal_profiles_select_own" on public.portal_profiles;
create policy "portal_profiles_select_own"
  on public.portal_profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "portal_profiles_coe_select_all" on public.portal_profiles;
create policy "portal_profiles_coe_select_all"
  on public.portal_profiles for select to authenticated
  using (
    exists (
      select 1
      from public.portal_profiles self
      where self.user_id = auth.uid()
        and self.portal = 'head_of_coe'::public.portal_type
    )
  );

drop policy if exists "portal_profiles_coe_delete" on public.portal_profiles;
create policy "portal_profiles_coe_delete"
  on public.portal_profiles for delete to authenticated
  using (
    exists (
      select 1
      from public.portal_profiles self
      where self.user_id = auth.uid()
        and self.portal = 'head_of_coe'::public.portal_type
    )
  );

grant select, delete on public.portal_profiles to authenticated;
grant all on public.portal_profiles to service_role;
