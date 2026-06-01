-- Marks card fields: CIA/ESE minimum marks and per-course pass/fail status
ALTER TABLE student_marks
ADD COLUMN IF NOT EXISTS cia_min_marks_theory numeric,
ADD COLUMN IF NOT EXISTS cia_min_marks_practical numeric,
ADD COLUMN IF NOT EXISTS ese_min_marks_theory numeric,
ADD COLUMN IF NOT EXISTS ese_min_marks_practical numeric,
ADD COLUMN IF NOT EXISTS course_status text,
ADD COLUMN IF NOT EXISTS course_type text;
