-- Add tracking for COE marks upload and Admin grade card issue date
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS marks_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS grade_card_issue_date DATE;

-- Comment for documentation
COMMENT ON COLUMN public.students.marks_uploaded_at IS 'Timestamp when COE uploaded the marks to trigger the 48-hour SLA timer.';
COMMENT ON COLUMN public.students.grade_card_issue_date IS 'Date selected by Admin to be printed on the Grade Card.';
