-- UUID of public.profiles.id in the external GCU library-management Supabase project.
-- Used to fetch rows from that project's `penalties` table for this student.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS library_remote_profile_id TEXT;

COMMENT ON COLUMN public.students.library_remote_profile_id IS
  'Optional. profiles.id in the external library Supabase project — used to fetch penalties.';
