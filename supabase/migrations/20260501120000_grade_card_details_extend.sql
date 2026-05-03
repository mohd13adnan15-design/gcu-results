-- Grade card header/footer lines (student-facing PDF). Subject rows remain in student_marks.

CREATE TABLE IF NOT EXISTS public.grade_card_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  student_name text NOT NULL,
  programme_title text NOT NULL,
  programme_code text NOT NULL,
  registration_no text,
  semester_label text,
  exam_month_year text,
  issue_date text,
  semester_gpa double precision,
  final_grade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS registration_no text;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS semester_label text;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS exam_month_year text;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS issue_date text;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS semester_gpa double precision;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS final_grade text;
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.grade_card_details ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS grade_card_details_student_id_idx ON public.grade_card_details (student_id);
