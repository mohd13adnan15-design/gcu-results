-- Lightweight degree certificate registry (no duplicate student/academic data).

CREATE TABLE IF NOT EXISTS public.degree_certificate_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  issue_date_iso date,
  qr_verification_base_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.degree_certificate_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.degree_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  certificate_number text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id),
  CONSTRAINT degree_certificates_student_unique UNIQUE (student_id),
  CONSTRAINT degree_certificates_number_unique UNIQUE (certificate_number)
);

CREATE INDEX IF NOT EXISTS degree_certificates_student_id_idx
  ON public.degree_certificates (student_id);

CREATE INDEX IF NOT EXISTS degree_certificates_number_idx
  ON public.degree_certificates (certificate_number);

ALTER TABLE public.degree_certificate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degree_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "degree_certificate_settings_anon_all"
  ON public.degree_certificate_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "degree_certificates_anon_all"
  ON public.degree_certificates
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.degree_certificates IS
  'Registry of issued degree certificate numbers — references students.id only; no duplicated academic rows.';

COMMENT ON TABLE public.degree_certificate_settings IS
  'Singleton configuration for degree certificate issuance (issue date, QR base URL).';
