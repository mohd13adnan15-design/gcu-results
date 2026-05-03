BEGIN;

CREATE TABLE IF NOT EXISTS public.student_summary (
  student_id text PRIMARY KEY,
  university text NOT NULL,
  program_title text NOT NULL,
  program_code text NOT NULL,
  student_name text NOT NULL,
  registration_no text NOT NULL UNIQUE,
  semester integer NOT NULL CHECK (semester > 0),
  exam_month_year text NOT NULL,
  total_credits numeric(10,2) NOT NULL DEFAULT 0,
  total_credits_earned numeric(10,2) NOT NULL DEFAULT 0,
  total_credit_points numeric(10,2) NOT NULL DEFAULT 0,
  sgpa numeric(10,2) NOT NULL DEFAULT 0,
  final_grade text,
  "date" date NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id text NOT NULL REFERENCES public.student_summary(student_id) ON DELETE CASCADE,
  sl_no integer NOT NULL CHECK (sl_no > 0),
  course_type text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  course_credits numeric(10,2) NOT NULL CHECK (course_credits >= 0),
  credits_earned numeric(10,2) NOT NULL DEFAULT 0 CHECK (credits_earned >= 0),
  grade_obtained text NOT NULL,
  grade_points numeric(10,2) NOT NULL DEFAULT 0 CHECK (grade_points >= 0),
  CONSTRAINT marks_student_sl_no_uniq UNIQUE (student_id, sl_no),
  CONSTRAINT marks_student_course_code_uniq UNIQUE (student_id, course_code),
  CONSTRAINT marks_ra_credits_check CHECK (
    grade_obtained <> 'RA' OR credits_earned = 0
  ),
  CONSTRAINT marks_credits_bound_check CHECK (
    credits_earned <= course_credits
  )
);

CREATE INDEX IF NOT EXISTS marks_student_id_idx ON public.marks(student_id);

CREATE OR REPLACE FUNCTION public.refresh_student_summary_totals(p_student_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_credits numeric(10,2) := 0;
  v_total_credits_earned numeric(10,2) := 0;
  v_total_credit_points numeric(10,2) := 0;
  v_sgpa numeric(10,2) := 0;
  v_has_ra boolean := false;
BEGIN
  SELECT
    COALESCE(SUM(m.course_credits), 0),
    COALESCE(SUM(m.credits_earned), 0),
    COALESCE(SUM(m.course_credits * m.grade_points), 0),
    BOOL_OR(m.grade_obtained = 'RA')
  INTO
    v_total_credits,
    v_total_credits_earned,
    v_total_credit_points,
    v_has_ra
  FROM public.marks m
  WHERE m.student_id = p_student_id;

  IF v_total_credits > 0 THEN
    v_sgpa := ROUND(v_total_credit_points / v_total_credits, 2);
  ELSE
    v_sgpa := 0;
  END IF;

  UPDATE public.student_summary s
  SET
    total_credits = v_total_credits,
    total_credits_earned = v_total_credits_earned,
    total_credit_points = v_total_credit_points,
    sgpa = v_sgpa,
    final_grade = CASE WHEN COALESCE(v_has_ra, false) THEN 'RA' ELSE s.final_grade END
  WHERE s.student_id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marks_before_write_set_ra_credits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.grade_obtained = 'RA' THEN
    NEW.credits_earned := 0;
    NEW.grade_points := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.marks_after_change_refresh_student_summary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_student_summary_totals(OLD.student_id);
  ELSE
    PERFORM public.refresh_student_summary_totals(NEW.student_id);
    IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
      PERFORM public.refresh_student_summary_totals(OLD.student_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS marks_before_write_set_ra_credits_tg ON public.marks;
CREATE TRIGGER marks_before_write_set_ra_credits_tg
BEFORE INSERT OR UPDATE ON public.marks
FOR EACH ROW
EXECUTE FUNCTION public.marks_before_write_set_ra_credits();

DROP TRIGGER IF EXISTS marks_after_change_refresh_student_summary_tg ON public.marks;
CREATE TRIGGER marks_after_change_refresh_student_summary_tg
AFTER INSERT OR UPDATE OR DELETE ON public.marks
FOR EACH ROW
EXECUTE FUNCTION public.marks_after_change_refresh_student_summary();

INSERT INTO public.student_summary (
  student_id,
  university,
  program_title,
  program_code,
  student_name,
  registration_no,
  semester,
  exam_month_year,
  total_credits,
  total_credits_earned,
  total_credit_points,
  sgpa,
  final_grade,
  "date"
) VALUES (
  'GCU-BCA-001',
  'Garden City University',
  'Bachelor of Computer Applications',
  'BCAR',
  'Lekkala Prabhakar Reddy',
  '22BCAR2241',
  1,
  'March 2023',
  25.00,
  19.00,
  127.00,
  5.08,
  'RA',
  DATE '2023-06-13'
)
ON CONFLICT (student_id)
DO UPDATE SET
  university = EXCLUDED.university,
  program_title = EXCLUDED.program_title,
  program_code = EXCLUDED.program_code,
  student_name = EXCLUDED.student_name,
  registration_no = EXCLUDED.registration_no,
  semester = EXCLUDED.semester,
  exam_month_year = EXCLUDED.exam_month_year,
  total_credits = EXCLUDED.total_credits,
  total_credits_earned = EXCLUDED.total_credits_earned,
  total_credit_points = EXCLUDED.total_credit_points,
  sgpa = EXCLUDED.sgpa,
  final_grade = EXCLUDED.final_grade,
  "date" = EXCLUDED."date";

DELETE FROM public.marks WHERE student_id = 'GCU-BCA-001';

INSERT INTO public.marks (
  student_id,
  sl_no,
  course_type,
  course_code,
  course_title,
  course_credits,
  credits_earned,
  grade_obtained,
  grade_points
) VALUES
  ('GCU-BCA-001', 1, 'CORE COURSE', '05ABCAR2111', 'PROBLEM SOLVING TECHNIQUE USING C', 2.00, 0.00, 'RA', 0.00),
  ('GCU-BCA-001', 2, 'CORE COURSE', '05ABCAR2112', 'DISCRETE MATHEMATICAL STRUCTURES', 3.00, 3.00, 'A+', 9.00),
  ('GCU-BCA-001', 3, 'CORE COURSE', '05ABCAR2113', 'FUNDAMENTALS OF COMPUTER ORGANIZATION', 4.00, 0.00, 'RA', 0.00),
  ('GCU-BCA-001', 4, 'PRACTICAL', '05ABCARP214', 'PROGRAMMING USING C LAB', 2.00, 2.00, 'A', 8.00),
  ('GCU-BCA-001', 5, 'PRACTICAL', '05ABCARP215', 'OFFICE AUTOMATION TOOLS LAB', 2.00, 2.00, 'B+', 7.00),
  ('GCU-BCA-001', 6, 'ABILITY ENHANCEMENT COMPULSORY COURSE', '04AAECC2124', 'FUNCTIONAL KANNADA', 3.00, 3.00, 'A', 8.00),
  ('GCU-BCA-001', 7, 'ABILITY ENHANCEMENT COMPULSORY COURSE', '04AAECC2125', 'ENVIRONMENTAL STUDIES', 2.00, 2.00, 'B+', 7.00),
  ('GCU-BCA-001', 8, 'SKILL ENHANCEMENT COURSE', '05ABCAR2161', 'DIGITAL PRODUCTIVITY TOOLS', 2.00, 2.00, 'B', 6.00),
  ('GCU-BCA-001', 9, 'PRACTICAL', '05ABCARP216', 'WEB TECHNOLOGY LAB', 2.00, 2.00, 'C', 5.00),
  ('GCU-BCA-001', 10, 'PRACTICAL', '05ABCARP217', 'DATA ANALYTICS LAB BASICS', 1.00, 1.00, 'C', 4.00),
  ('GCU-BCA-001', 11, 'OPEN ELECTIVE COURSE', '05ABOEC218', 'INDIAN CONSTITUTION AND CIVICS', 2.00, 2.00, 'D', 3.00);

SELECT public.refresh_student_summary_totals('GCU-BCA-001');

COMMIT;