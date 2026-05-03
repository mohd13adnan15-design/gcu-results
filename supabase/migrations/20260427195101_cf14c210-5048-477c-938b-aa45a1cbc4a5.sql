
-- Portal admin credentials (Developer, Library, Hostel, Fees)
CREATE TYPE public.portal_type AS ENUM ('developer', 'library', 'hostel', 'fees');

CREATE TABLE public.portal_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  portal public.portal_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students roster
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE,           -- e.g. 24btre148
  email TEXT NOT NULL UNIQUE,                -- e.g. 24btre148@gcu.edu.in
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  semester INT NOT NULL,
  year INT NOT NULL,

  -- Membership: is this student registered on each portal?
  in_library BOOLEAN NOT NULL DEFAULT false,
  in_hostel BOOLEAN NOT NULL DEFAULT false,
  in_fees BOOLEAN NOT NULL DEFAULT true,     -- everyone is in fees

  -- Clearance flags toggled by each admin
  library_cleared BOOLEAN NOT NULL DEFAULT false,
  hostel_cleared BOOLEAN NOT NULL DEFAULT false,
  fees_cleared BOOLEAN NOT NULL DEFAULT false,

  -- Progress amounts (for student progress bars)
  fees_total NUMERIC NOT NULL DEFAULT 100000,
  fees_paid NUMERIC NOT NULL DEFAULT 0,
  hostel_total NUMERIC NOT NULL DEFAULT 50000,
  hostel_paid NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX students_dept_idx ON public.students(department);
CREATE INDEX students_sem_idx ON public.students(semester);
CREATE INDEX students_year_idx ON public.students(year);

-- Library books per student
CREATE TABLE public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  borrowed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  returned BOOLEAN NOT NULL DEFAULT false,
  returned_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX library_books_student_idx ON public.library_books(student_id);

-- Marks per student
CREATE TABLE public.student_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  credits INT NOT NULL DEFAULT 4,
  marks_obtained INT NOT NULL,
  max_marks INT NOT NULL DEFAULT 100,
  grade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX student_marks_student_idx ON public.student_marks(student_id);

-- Email OTPs for marks card verification
CREATE TABLE public.email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_otps_email_idx ON public.email_otps(email);

-- RLS: enable but allow all (auth handled in app code for this demo)
ALTER TABLE public.portal_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON public.portal_admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON public.library_books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON public.student_marks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON public.email_otps FOR ALL USING (true) WITH CHECK (true);
