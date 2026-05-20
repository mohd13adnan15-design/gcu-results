-- Add grouped columns and course priority to student_marks
ALTER TABLE student_marks
ADD COLUMN IF NOT EXISTS cia_max_marks_theory numeric,
ADD COLUMN IF NOT EXISTS cia_max_marks_practical numeric,
ADD COLUMN IF NOT EXISTS cia_marks_obtained_theory numeric,
ADD COLUMN IF NOT EXISTS cia_marks_obtained_practical numeric,
ADD COLUMN IF NOT EXISTS ese_max_marks_theory numeric,
ADD COLUMN IF NOT EXISTS ese_max_marks_practical numeric,
ADD COLUMN IF NOT EXISTS ese_marks_obtained_theory numeric,
ADD COLUMN IF NOT EXISTS ese_marks_obtained_practical numeric,
ADD COLUMN IF NOT EXISTS total_marks_theory numeric,
ADD COLUMN IF NOT EXISTS total_marks_practical numeric,
ADD COLUMN IF NOT EXISTS course_priority integer DEFAULT 1;

-- Add course_priority to main_grade_card if needed (for backwards compatibility/ease)
ALTER TABLE main_grade_card
ADD COLUMN IF NOT EXISTS course_priority integer DEFAULT 1;
