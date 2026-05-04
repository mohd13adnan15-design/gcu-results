-- Restores API tables used by admin / faculty / super-admin marks flows.
-- A 404 from PostgREST on /rest/v1/<table> usually means the table was never created in this project.

-- --- student_marks: per-subject rows (Excel upload + Super Admin editor)
create table if not exists public.student_marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_category text not null default 'CORE COURSE',
  subject text not null,
  subject_code text not null,
  credits numeric not null,
  credits_earned numeric not null default 0,
  marks_obtained numeric not null default 0,
  max_marks numeric not null default 100,
  grade text not null,
  grade_points numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists student_marks_student_id_idx on public.student_marks (student_id);

-- --- grade_card_details: one summary row per student (header + SGPA display)
create table if not exists public.grade_card_details (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  student_name text not null,
  programme_title text not null,
  programme_code text not null,
  registration_no text,
  semester_label text,
  exam_month_year text,
  issue_date text,
  semester_gpa double precision,
  final_grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_card_details_student_id_key unique (student_id)
);

-- --- main_grade_card: printed card rows (synced from editor / upload)
create table if not exists public.main_grade_card (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  row_number integer not null,
  programme_title text,
  programme_code text,
  student_name text,
  registration_no text,
  semester_label text,
  exam_month_year text,
  issue_date text,
  semester_gpa double precision,
  final_grade text,
  total_credits double precision,
  total_credit_points double precision,
  qr_data text,
  photo_url text,
  course_code text,
  course_title text,
  course_credits double precision,
  credits_earned double precision,
  grade text,
  grade_points double precision,
  course_category text,
  marks_obtained double precision,
  max_marks double precision,
  subject text,
  subject_code text,
  credits double precision,
  practical_1 text,
  ability_enhancement_compulsory_course text,
  skill_enhancement_course text,
  practical_2 text,
  objective_enhancement_course text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint main_grade_card_student_row_key unique (student_id, row_number)
);

create index if not exists main_grade_card_student_id_idx on public.main_grade_card (student_id);

-- --- student_marksheets: JSON marksheet for student PDF (optional but used when syncing)
create table if not exists public.student_marksheets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  courses jsonb not null default '[]'::jsonb,
  university text not null default 'Garden City University',
  school_name text not null default '',
  programme_title text not null default '',
  programme_code text not null default '',
  student_name text not null default '',
  student_roll_no text not null default '',
  registration_no text not null default '',
  semester_label text not null default '',
  exam_month_year text not null default '',
  issue_date text not null default '',
  grade_card_no text not null default '',
  qr_data text not null default '',
  photo_bucket text,
  photo_path text,
  total_credits numeric not null default 0,
  total_credits_earned numeric not null default 0,
  total_credit_points numeric not null default 0,
  sgpa numeric not null default 0,
  final_grade text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_marksheets_student_id_key unique (student_id)
);

-- RLS: enable with permissive policies so the anon key used by this portal can read/write.
-- Tighten policies when you move to Supabase Auth–based access.

alter table public.student_marks enable row level security;
alter table public.grade_card_details enable row level security;
alter table public.main_grade_card enable row level security;
alter table public.student_marksheets enable row level security;

drop policy if exists "student_marks_anon_all" on public.student_marks;
create policy "student_marks_anon_all" on public.student_marks for all using (true) with check (true);

drop policy if exists "grade_card_details_anon_all" on public.grade_card_details;
create policy "grade_card_details_anon_all" on public.grade_card_details for all using (true) with check (true);

drop policy if exists "main_grade_card_anon_all" on public.main_grade_card;
create policy "main_grade_card_anon_all" on public.main_grade_card for all using (true) with check (true);

drop policy if exists "student_marksheets_anon_all" on public.student_marksheets;
create policy "student_marksheets_anon_all" on public.student_marksheets for all using (true) with check (true);

grant select, insert, update, delete on public.student_marks to anon, authenticated, service_role;
grant select, insert, update, delete on public.grade_card_details to anon, authenticated, service_role;
grant select, insert, update, delete on public.main_grade_card to anon, authenticated, service_role;
grant select, insert, update, delete on public.student_marksheets to anon, authenticated, service_role;
