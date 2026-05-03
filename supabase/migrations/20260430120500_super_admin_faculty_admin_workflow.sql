-- Rename developer portal and introduce faculty/admin workflow.
ALTER TYPE public.portal_type RENAME VALUE 'developer' TO 'super_admin';
ALTER TYPE public.portal_type ADD VALUE IF NOT EXISTS 'faculty';
ALTER TYPE public.portal_type ADD VALUE IF NOT EXISTS 'admin';

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS faculty_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS fully_verified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_portal public.portal_type NOT NULL,
  sender_portal public.portal_type NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_notifications_recipient_idx
  ON public.portal_notifications(recipient_portal, is_read, created_at DESC);

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all notifications" ON public.portal_notifications
FOR ALL USING (true) WITH CHECK (true);

-- Add default credentials for the new internal portals.
INSERT INTO public.portal_admins (username, password, portal)
VALUES
  ('superadmin@gcu.edu.in', 'superadmin123', 'super_admin'),
  ('faculty@gcu.edu.in', 'faculty123', 'faculty'),
  ('admin@gcu.edu.in', 'admin123', 'admin')
ON CONFLICT (username) DO UPDATE
SET
  password = EXCLUDED.password,
  portal = EXCLUDED.portal;
