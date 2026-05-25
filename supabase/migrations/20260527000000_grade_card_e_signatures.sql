-- E-signatures for grade card back page (Checked by / Verified by)
CREATE TABLE IF NOT EXISTS public.grade_card_e_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  signature_role text NOT NULL CHECK (signature_role IN ('checked_by', 'verified_by')),
  admin_id uuid NOT NULL,
  signature_url text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  signed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, signature_role)
);

CREATE INDEX IF NOT EXISTS grade_card_e_signatures_student_id_idx
  ON public.grade_card_e_signatures (student_id);

CREATE INDEX IF NOT EXISTS grade_card_e_signatures_status_idx
  ON public.grade_card_e_signatures (status);

ALTER TABLE public.grade_card_e_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_card_e_signatures_anon_all"
  ON public.grade_card_e_signatures
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.grade_card_e_signatures IS
  'Draft and approved e-signatures for grade card back page (Checked by / Verified by).';
