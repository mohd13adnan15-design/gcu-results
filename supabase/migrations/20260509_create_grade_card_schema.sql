-- Grade Card Schema based on official GCU template
-- This schema is designed to store complete grade card information for students

-- Create enum for school names
CREATE TYPE school_enum AS ENUM (
  'SCHOOL OF COMMERCE AND MANAGEMENT',
  'SCHOOL OF ENGINEERING AND TECHNOLOGY',
  'SCHOOL OF LIBERAL ARTS AND SCIENCES',
  'SCHOOL OF BUSINESS AND ADMINISTRATION'
);

-- Create enum for grade values
CREATE TYPE grade_enum AS ENUM (
  'O', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'RA', 'SA', 'AB'
);

-- Create the main grade_card table
CREATE TABLE IF NOT EXISTS public.grade_card (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Header Information
  grade_card_no TEXT NOT NULL UNIQUE,
  qr_code TEXT,
  student_photo_url TEXT,
  
  -- University Information
  university_name TEXT NOT NULL DEFAULT 'Garden City University'::TEXT,
  university_tagline TEXT NOT NULL DEFAULT 'EMPHASIS ON LIFE'::TEXT,
  school_name school_enum NOT NULL,
  
  -- Student Information
  student_id UUID NOT NULL,
  student_name TEXT NOT NULL,
  student_roll_no TEXT NOT NULL UNIQUE,
  registration_no TEXT NOT NULL,
  programme_title TEXT NOT NULL,
  programme_code TEXT NOT NULL,
  semester INT NOT NULL,
  exam_month_year TEXT NOT NULL,
  
  -- Course Information (JSONB for flexibility)
  -- Structure: 
  -- {
  --   "core_courses": [...],
  --   "practical_courses": [...],
  --   "ability_enhancement_courses": [...],
  --   "skill_enhancement_courses": [...],
  --   "open_elective_courses": [...]
  -- }
  -- Each course: { "sl_no": 1, "course_code": "...", "course_title": "...", "credits": 4.0, "credits_earned": 4.0, "grade_obtained": "A", "grade_points": 8.0 }
  courses JSONB NOT NULL,
  
  -- Grade Summary
  total_credits NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_credits_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_credit_points NUMERIC(10, 2) NOT NULL DEFAULT 0,
  semester_grade_point_average NUMERIC(10, 2) NOT NULL DEFAULT 0,
  final_grade grade_enum NOT NULL DEFAULT 'RA'::grade_enum,
  
  -- Footer Information
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  seal_image_url TEXT,
  controller_signature_url TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT grade_card_pkey PRIMARY KEY (id),
  CONSTRAINT grade_card_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT grade_card_courses_check CHECK (jsonb_typeof(courses) = 'array'::text),
  CONSTRAINT grade_card_credits_check CHECK (total_credits >= 0 AND total_credits_earned >= 0),
  CONSTRAINT grade_card_gpa_check CHECK (semester_grade_point_average >= 0 AND semester_grade_point_average <= 10)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS grade_card_student_id_idx ON public.grade_card (student_id);
CREATE INDEX IF NOT EXISTS grade_card_student_roll_no_idx ON public.grade_card (student_roll_no);
CREATE INDEX IF NOT EXISTS grade_card_registration_no_idx ON public.grade_card (registration_no);
CREATE INDEX IF NOT EXISTS grade_card_semester_idx ON public.grade_card (semester);
CREATE INDEX IF NOT EXISTS grade_card_school_idx ON public.grade_card (school_name);
CREATE INDEX IF NOT EXISTS grade_card_issue_date_idx ON public.grade_card (issue_date);

-- Create trigger function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_grade_card_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp update
DROP TRIGGER IF EXISTS grade_card_update_timestamp_tg ON public.grade_card;
CREATE TRIGGER grade_card_update_timestamp_tg
BEFORE UPDATE ON public.grade_card
FOR EACH ROW
EXECUTE FUNCTION public.update_grade_card_timestamp();

-- Create course structure table for reference (optional but recommended)
CREATE TABLE IF NOT EXISTS public.grade_card_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  grade_card_id UUID NOT NULL,
  
  -- Course Details
  course_category TEXT NOT NULL CHECK (course_category IN (
    'CORE COURSE',
    'PRACTICAL',
    'ABILITY ENHANCEMENT COMPULSORY COURSE',
    'SKILL ENHANCEMENT COURSE',
    'OPEN ELECTIVE COURSE'
  )),
  sl_no INT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  credits NUMERIC(5, 2) NOT NULL,
  credits_earned NUMERIC(5, 2) NOT NULL,
  grade_obtained grade_enum NOT NULL,
  grade_points NUMERIC(10, 2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT grade_card_courses_pkey PRIMARY KEY (id),
  CONSTRAINT grade_card_courses_grade_card_id_fkey FOREIGN KEY (grade_card_id) REFERENCES public.grade_card (id) ON DELETE CASCADE,
  CONSTRAINT grade_card_courses_credits_check CHECK (credits > 0 AND credits_earned >= 0),
  CONSTRAINT grade_card_courses_gpa_check CHECK (grade_points >= 0)
);

-- Create indexes for courses
CREATE INDEX IF NOT EXISTS grade_card_courses_grade_card_id_idx ON public.grade_card_courses (grade_card_id);
CREATE INDEX IF NOT EXISTS grade_card_courses_category_idx ON public.grade_card_courses (course_category);

-- Enable Row Level Security (RLS)
ALTER TABLE public.grade_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_card_courses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for grade_card
CREATE POLICY "Students can view their own grade cards"
  ON public.grade_card
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Only admins can insert grade cards"
  ON public.grade_card
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'super_admin');

CREATE POLICY "Only admins can update grade cards"
  ON public.grade_card
  FOR UPDATE
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'super_admin');

-- Create RLS policies for grade_card_courses
CREATE POLICY "Students can view courses for their grade cards"
  ON public.grade_card_courses
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.grade_card
    WHERE id = grade_card_id
    AND student_id = auth.uid()
  ));

CREATE POLICY "Only admins can insert courses"
  ON public.grade_card_courses
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'super_admin');

-- Create helper function to calculate SGPA
CREATE OR REPLACE FUNCTION public.calculate_sgpa(total_grade_points NUMERIC, total_credits NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF total_credits = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(total_grade_points / total_credits, 2);
END;
$$ LANGUAGE plpgsql;

-- Create helper function to determine final grade from SGPA
CREATE OR REPLACE FUNCTION public.get_final_grade(sgpa NUMERIC)
RETURNS grade_enum AS $$
BEGIN
  CASE
    WHEN sgpa >= 9.0 THEN RETURN 'O'::grade_enum;
    WHEN sgpa >= 8.5 THEN RETURN 'A+'::grade_enum;
    WHEN sgpa >= 8.0 THEN RETURN 'A'::grade_enum;
    WHEN sgpa >= 7.5 THEN RETURN 'A-'::grade_enum;
    WHEN sgpa >= 7.0 THEN RETURN 'B+'::grade_enum;
    WHEN sgpa >= 6.5 THEN RETURN 'B'::grade_enum;
    WHEN sgpa >= 6.0 THEN RETURN 'B-'::grade_enum;
    WHEN sgpa >= 5.5 THEN RETURN 'C+'::grade_enum;
    WHEN sgpa >= 5.0 THEN RETURN 'C'::grade_enum;
    WHEN sgpa >= 4.5 THEN RETURN 'C-'::grade_enum;
    WHEN sgpa >= 4.0 THEN RETURN 'D+'::grade_enum;
    WHEN sgpa >= 3.5 THEN RETURN 'D'::grade_enum;
    ELSE RETURN 'RA'::grade_enum;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables for documentation
COMMENT ON TABLE public.grade_card IS 'Stores complete grade card information for students based on official GCU template';
COMMENT ON TABLE public.grade_card_courses IS 'Normalized course details for grade cards';
COMMENT ON COLUMN public.grade_card.courses IS 'JSONB array containing all course categories and their courses';
COMMENT ON COLUMN public.grade_card.semester_grade_point_average IS 'Semester Grade Point Average (SGPA)';
COMMENT ON COLUMN public.grade_card.final_grade IS 'Final grade determined from SGPA';
