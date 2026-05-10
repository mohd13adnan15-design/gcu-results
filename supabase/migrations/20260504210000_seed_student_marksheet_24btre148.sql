-- Demo marksheet row for 24btre148 (Aarav Sharma), parallel to the Tejashvi / 24btre152 reference data.
-- Runs only if public.students already contains student_id = '24btre148'.

insert into public.student_marksheets (
  student_id,
  courses,
  university,
  school_name,
  programme_title,
  programme_code,
  student_name,
  student_roll_no,
  registration_no,
  semester_label,
  exam_month_year,
  issue_date,
  grade_card_no,
  qr_data,
  photo_bucket,
  photo_path,
  total_credits,
  total_credits_earned,
  total_credit_points,
  sgpa,
  final_grade
)
select
  s.id,
  jsonb_build_array(
    jsonb_build_object(
      'sl_no', 1,
      'section', 'CORE COURSE',
      'course_code', '24BTRE3511',
      'course_title', 'INTRODUCTION TO AI FOR ROBOTICS',
      'course_credits', 4,
      'credits_earned', 4,
      'grade_obtained', 'A+',
      'grade_points', 9
    ),
    jsonb_build_object(
      'sl_no', 2,
      'section', 'CORE COURSE',
      'course_code', '24BTRE3512',
      'course_title', 'EMBEDDED SYSTEMS',
      'course_credits', 4,
      'credits_earned', 4,
      'grade_obtained', 'A',
      'grade_points', 8
    ),
    jsonb_build_object(
      'sl_no', 3,
      'section', 'CORE COURSE',
      'course_code', '24BTRE3513',
      'course_title', 'INDUSTRIAL ROBOTICS',
      'course_credits', 3,
      'credits_earned', 3,
      'grade_obtained', 'B+',
      'grade_points', 7
    ),
    jsonb_build_object(
      'sl_no', 4,
      'section', 'PRACTICAL',
      'course_code', '24BTREP3514',
      'course_title', 'ROBOT VISION LAB',
      'course_credits', 2,
      'credits_earned', 2,
      'grade_obtained', 'O',
      'grade_points', 10
    ),
    jsonb_build_object(
      'sl_no', 5,
      'section', 'PRACTICAL',
      'course_code', '24BTREP3515',
      'course_title', 'HYDRAULICS AND PNEUMATICS LAB',
      'course_credits', 2,
      'credits_earned', 2,
      'grade_obtained', 'A',
      'grade_points', 8
    ),
    jsonb_build_object(
      'sl_no', 6,
      'section', 'ABILITY ENHANCEMENT COMPULSORY COURSE',
      'course_code', '24AAECC3516',
      'course_title', 'BUSINESS COMMUNICATION',
      'course_credits', 3,
      'credits_earned', 3,
      'grade_obtained', 'A+',
      'grade_points', 9
    ),
    jsonb_build_object(
      'sl_no', 7,
      'section', 'ABILITY ENHANCEMENT COMPULSORY COURSE',
      'course_code', '24AAECC3517',
      'course_title', 'INDIAN KNOWLEDGE SYSTEM',
      'course_credits', 2,
      'credits_earned', 2,
      'grade_obtained', 'B+',
      'grade_points', 7
    ),
    jsonb_build_object(
      'sl_no', 8,
      'section', 'SKILL ENHANCEMENT COURSE',
      'course_code', '24BTSEC3518',
      'course_title', 'MACHINE LEARNING ESSENTIALS',
      'course_credits', 2,
      'credits_earned', 2,
      'grade_obtained', 'A',
      'grade_points', 8
    ),
    jsonb_build_object(
      'sl_no', 9,
      'section', 'PRACTICAL',
      'course_code', '24BTREP3519',
      'course_title', 'DRIVES AND ACTUATORS LAB',
      'course_credits', 1,
      'credits_earned', 1,
      'grade_obtained', 'A+',
      'grade_points', 9
    ),
    jsonb_build_object(
      'sl_no', 10,
      'section', 'PRACTICAL',
      'course_code', '24BTREP3520',
      'course_title', 'VIRTUAL REALITY WORKSHOP',
      'course_credits', 1,
      'credits_earned', 1,
      'grade_obtained', 'B',
      'grade_points', 6
    ),
    jsonb_build_object(
      'sl_no', 11,
      'section', 'OPEN ELECTIVE COURSE',
      'course_code', '24AOPEL3521',
      'course_title', 'PRINCIPLES OF ECONOMICS',
      'course_credits', 1,
      'credits_earned', 1,
      'grade_obtained', 'A',
      'grade_points', 8
    )
  ),
  'Garden City University',
  'SCHOOL OF ENGINEERING AND TECHNOLOGY',
  'Bachelor of Technology in Robotics and Automation',
  'BTRE',
  'Aarav Sharma',
  '24btre148',
  '24BTRE148',
  '5',
  'November - 2025',
  '2026-05-04',
  'GCUBTRE148',
  'GCU|24btre148|24BTRE148|Aarav Sharma|BTRE|Semester 5',
  'student-photos',
  '24btre148/profile.jpeg',
  25,
  25,
  205,
  8.2,
  'A+'
from public.students s
where s.student_id = '24btre148'
on conflict (student_id) do update set
  courses = excluded.courses,
  university = excluded.university,
  school_name = excluded.school_name,
  programme_title = excluded.programme_title,
  programme_code = excluded.programme_code,
  student_name = excluded.student_name,
  student_roll_no = excluded.student_roll_no,
  registration_no = excluded.registration_no,
  semester_label = excluded.semester_label,
  exam_month_year = excluded.exam_month_year,
  issue_date = excluded.issue_date,
  grade_card_no = excluded.grade_card_no,
  qr_data = excluded.qr_data,
  photo_bucket = excluded.photo_bucket,
  photo_path = excluded.photo_path,
  total_credits = excluded.total_credits,
  total_credits_earned = excluded.total_credits_earned,
  total_credit_points = excluded.total_credit_points,
  sgpa = excluded.sgpa,
  final_grade = excluded.final_grade,
  updated_at = now();
