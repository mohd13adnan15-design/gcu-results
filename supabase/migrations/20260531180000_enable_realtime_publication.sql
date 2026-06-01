-- Realtime: expose tables used by portal live subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_marksheets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_marksheets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_marks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_marks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grade_card_details'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grade_card_details;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notifications;
  END IF;
END $$;
