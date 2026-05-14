-- One header row in grade_card_details for 24btre148 (Aarav Sharma), matching
-- 20260504210000_seed_student_marksheet_24btre148 / AARAV_MARKSHEET_SEED in the app.
-- Only runs if public.students already has student_id = '24btre148'.

insert into public.grade_card_details (
  student_id,
  student_name,
  programme_title,
  programme_code,
  registration_no,
  semester_label,
  exam_month_year,
  issue_date,
  semester_gpa,
  final_grade
)
select
  s.id,
  'Aarav Sharma',
  'Bachelor of Technology in Robotics and Automation',
  'BTRE',
  '24BTRE148',
  '5',
  'November - 2025',
  '2026-05-04',
  8.2,
  'A+'
from public.students s
where s.student_id = '24btre148'
on conflict (student_id) do update set
  student_name = excluded.student_name,
  programme_title = excluded.programme_title,
  programme_code = excluded.programme_code,
  registration_no = excluded.registration_no,
  semester_label = excluded.semester_label,
  exam_month_year = excluded.exam_month_year,
  issue_date = excluded.issue_date,
  semester_gpa = excluded.semester_gpa,
  final_grade = excluded.final_grade,
  updated_at = now();
