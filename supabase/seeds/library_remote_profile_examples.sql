-- One-time: link result-portal students to library `profiles.id` UUIDs
-- from the vrut… library-management project (Table Editor → public.profiles).
-- Replace placeholders with real UUIDs from that project — do not reuse example values.

UPDATE public.students
SET library_remote_profile_id = 'REPLACE_WITH_PROFILE_UUID_FROM_LIBRARY_DB'
WHERE email ILIKE '24btre151@gcu.edu.in';

UPDATE public.students
SET library_remote_profile_id = 'REPLACE_WITH_PROFILE_UUID_FROM_LIBRARY_DB'
WHERE email ILIKE '24btre111@gcu.edu.in';

-- Leave Anwar unset if they are not enrolled in library (in_library = false):

-- UPDATE public.students SET in_library = true WHERE …
