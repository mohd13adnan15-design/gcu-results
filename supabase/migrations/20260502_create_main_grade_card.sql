-- Main grade card table combining header and course rows
CREATE TABLE IF NOT EXISTS public.main_grade_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  
  -- Header row fields (row_number = 1)
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
  
  -- Course row fields (row_number > 1)
  course_code text,
  course_title text,
  course_credits double precision,
  credits_earned double precision,
  grade text,
  grade_points double precision,
  course_category text,
  marks_obtained double precision,
  max_marks double precision,
  
  -- Legacy fields for compatibility
  subject text,
  subject_code text,
  credits double precision,
  
  -- Section label fields
  practical_1 text,
  ability_enhancement_compulsory_course text,
  skill_enhancement_course text,
  practical_2 text,
  objective_enhancement_course text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS main_grade_card_student_id_idx ON public.main_grade_card (student_id);
CREATE INDEX IF NOT EXISTS main_grade_card_row_number_idx ON public.main_grade_card (row_number);
CREATE INDEX IF NOT EXISTS main_grade_card_student_row_idx ON public.main_grade_card (student_id, row_number);

-- Enable RLS
ALTER TABLE public.main_grade_card ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Students can view their own grade card" ON public.main_grade_card
  FOR SELECT USING (
    student_id = (SELECT auth.uid())
  );
