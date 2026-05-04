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

drop trigger if exists set_students_fully_verified_tg on public.students;

create trigger set_students_fully_verified_tg
before insert or update of
  fees_cleared,
  in_hostel,
  hostel_cleared,
  in_library,
  library_cleared,
  faculty_verified,
  admin_verified,
  fully_verified
on public.students
for each row
execute function public.set_students_fully_verified();

update public.students
set fully_verified =
  coalesce(fees_cleared, false)
  and (not coalesce(in_hostel, false) or coalesce(hostel_cleared, false))
  and (not coalesce(in_library, false) or coalesce(library_cleared, false))
  and coalesce(faculty_verified, false)
  and coalesce(admin_verified, false);
