-- Retire admin_1 / admin_2 portal labels in favour of head_of_coe and admin.

update public.portal_profiles
set portal = 'head_of_coe'::public.portal_type
where portal::text = 'admin_1';

update public.portal_profiles
set portal = 'admin'::public.portal_type
where portal::text = 'admin_2';

update public.portal_notifications
set recipient_portal = 'head_of_coe'
where recipient_portal::text = 'admin_1';

update public.portal_notifications
set sender_portal = 'head_of_coe'
where sender_portal::text = 'admin_1';

update public.portal_notifications
set recipient_portal = 'admin'
where recipient_portal::text = 'admin_2';

update public.portal_notifications
set sender_portal = 'admin'
where sender_portal::text = 'admin_2';

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
         and pn.recipient_portal = 'admin'
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
      'admin',
      'fees',
      new.id,
      'Grade card requested',
      new.full_name || ' (' || new.student_id || ') requested a grade card. Review in the Admin Queue.'
    );
  end if;

  return new;
end;
$$;
