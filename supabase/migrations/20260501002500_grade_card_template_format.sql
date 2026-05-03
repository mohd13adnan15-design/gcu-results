-- Store per-student grade-card header/profile details.
CREATE TABLE IF NOT EXISTS public.student_grade_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  programme_title TEXT NOT NULL DEFAULT 'Bachelor of Computer Applications',
  programme_code TEXT NOT NULL DEFAULT 'BCAR',
  registration_no TEXT NOT NULL DEFAULT '',
  exam_month_year TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL DEFAULT '',
  semester_label TEXT NOT NULL DEFAULT '',
  total_credits NUMERIC NOT NULL DEFAULT 0,
  total_credits_earned NUMERIC NOT NULL DEFAULT 0,
  total_credit_points NUMERIC NOT NULL DEFAULT 0,
  semester_gpa NUMERIC NOT NULL DEFAULT 0,
  final_grade TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_grade_profiles_student_idx
  ON public.student_grade_profiles(student_id);

ALTER TABLE public.student_grade_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all student_grade_profiles" ON public.student_grade_profiles;
CREATE POLICY "allow all student_grade_profiles"
ON public.student_grade_profiles
FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.student_marks
ADD COLUMN IF NOT EXISTS course_category TEXT NOT NULL DEFAULT 'CORE COURSE',
ADD COLUMN IF NOT EXISTS credits_earned NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS grade_points NUMERIC NOT NULL DEFAULT 0;
