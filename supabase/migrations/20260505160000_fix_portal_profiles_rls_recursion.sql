-- RLS policies that do "EXISTS (SELECT 1 FROM portal_profiles ...)" on the same table
-- cause infinite recursion (Postgres re-applies RLS in the subquery) → REST 500 on /portal_profiles.
-- Replace with a SECURITY DEFINER helper so the inner read bypasses RLS for the role owner.

create or replace function public.portal_profiles_is_head_of_coe()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.portal_profiles p
    where p.user_id = auth.uid()
      and p.portal = 'head_of_coe'::public.portal_type
  );
$$;

grant execute on function public.portal_profiles_is_head_of_coe() to authenticated;

drop policy if exists "portal_profiles_coe_select_all" on public.portal_profiles;
create policy "portal_profiles_coe_select_all"
  on public.portal_profiles for select to authenticated
  using (public.portal_profiles_is_head_of_coe());

drop policy if exists "portal_profiles_coe_delete" on public.portal_profiles;
create policy "portal_profiles_coe_delete"
  on public.portal_profiles for delete to authenticated
  using (public.portal_profiles_is_head_of_coe());
