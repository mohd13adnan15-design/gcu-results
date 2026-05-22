CREATE TABLE IF NOT EXISTS public.departments (
  name text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Insert defaults
INSERT INTO public.departments (name)
VALUES ('CSE'), ('ECE'), ('MECH'), ('CIVIL'), ('Food Technology'), ('Robotics'), ('SET')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions for anon/authenticated roles
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Allow read access for all'
  ) THEN
    CREATE POLICY "Allow read access for all" ON public.departments FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Allow insert/write access for all'
  ) THEN
    CREATE POLICY "Allow insert/write access for all" ON public.departments FOR ALL USING (true);
  END IF;
END
$$;
