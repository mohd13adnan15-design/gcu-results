alter function public.set_student_marksheets_updated_at()
set search_path = public, pg_temp;

alter function public.set_main_grade_card_updated_at()
set search_path = public, pg_temp;

create index if not exists portal_notifications_student_id_idx
on public.portal_notifications (student_id);
