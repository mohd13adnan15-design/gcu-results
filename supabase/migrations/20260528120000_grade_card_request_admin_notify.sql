-- Notify Admin when a student first requests grade card verification.

create or replace function public.notify_admin_grade_card_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.marksheet_verification_requested_at is not null
     and (old.marksheet_verification_requested_at is null
          or old.marksheet_verification_requested_at is distinct from new.marksheet_verification_requested_at)
     and not exists (
       select 1
       from public.portal_notifications pn
       where pn.student_id = new.id
         and pn.recipient_portal = 'admin_2'
         and pn.title = 'Grade card requested'
         and pn.is_resolved = false
     ) then
    insert into public.portal_notifications (
      recipient_portal,
      sender_portal,
      student_id,
      title,
      message
    )
    values (
      'admin_2',
      'fees',
      new.id,
      'Grade card requested',
      new.full_name || ' (' || new.student_id || ') requested a grade card. Review in the Admin Queue.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists students_grade_card_request_notify on public.students;

create trigger students_grade_card_request_notify
after update of marksheet_verification_requested_at on public.students
for each row
execute function public.notify_admin_grade_card_request();
