-- Student-initiated marksheet verification: faculty/admin only act after the student requests.

alter table public.students
  add column if not exists marksheet_verification_requested_at timestamptz;

comment on column public.students.marksheet_verification_requested_at is
  'Set when the student requests marksheet verification from the portal; faculty/admin queues filter on this.';
