create or replace function public.set_students_fully_verified()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.fully_verified :=
    coalesce(new.fees_cleared, false)
    and (not coalesce(new.in_hostel, false) or coalesce(new.hostel_cleared, false))
    and (not coalesce(new.in_library, false) or coalesce(new.library_cleared, false))
    and coalesce(new.faculty_verified, false)
    and coalesce(new.admin_verified, false);

  return new;
end;
$$;
