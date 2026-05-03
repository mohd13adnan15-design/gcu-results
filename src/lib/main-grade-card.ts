import type { Student, StudentMarkRow, StudentGradeProfile } from "@/lib/types";

export type MainGradeCardRow = {
  id?: string;
  student_id: string;
  row_number: number;
  programme_title?: string | null;
  programme_code?: string | null;
  student_name?: string | null;
  registration_no?: string | null;
  semester_label?: string | null;
  exam_month_year?: string | null;
  issue_date?: string | null;
  semester_gpa?: number | null;
  final_grade?: string | null;
  total_credits?: number | null;
  total_credit_points?: number | null;
  qr_data?: string | null;
  photo_url?: string | null;
  course_code?: string | null;
  course_title?: string | null;
  course_credits?: number | null;
  credits_earned?: number | null;
  grade?: string | null;
  grade_points?: number | null;
  course_category?: string | null;
  marks_obtained?: number | null;
  max_marks?: number | null;
  subject?: string | null;
  subject_code?: string | null;
  credits?: number | null;
  practical_1?: string | null;
  ability_enhancement_compulsory_course?: string | null;
  skill_enhancement_course?: string | null;
  practical_2?: string | null;
  objective_enhancement_course?: string | null;
};

export type MainGradeCardHeader = Pick<
  StudentGradeProfile,
  | "programme_title"
  | "programme_code"
  | "registration_no"
  | "exam_month_year"
  | "issue_date"
  | "semester_label"
  | "total_credits"
  | "total_credit_points"
  | "semester_gpa"
  | "final_grade"
> & {
  student_name?: string | null;
  qr_data?: string | null;
  photo_url?: string | null;
  practical_1?: string | null;
  ability_enhancement_compulsory_course?: string | null;
  skill_enhancement_course?: string | null;
  practical_2?: string | null;
  objective_enhancement_course?: string | null;
};

export function buildMainGradeCardRows(
  student: Student,
  header: MainGradeCardHeader,
  marks: StudentMarkRow[],
): MainGradeCardRow[] {
  const totalCredits =
    header.total_credits ?? marks.reduce((sum, mark) => sum + Number(mark.credits ?? 0), 0);
  const totalCreditPoints =
    header.total_credit_points ??
    marks.reduce(
      (sum, mark) => sum + Number(mark.grade_points ?? 0) * Number(mark.credits ?? 0),
      0,
    );
  const semesterGpa =
    header.semester_gpa ?? (totalCredits > 0 ? Number((totalCreditPoints / totalCredits).toFixed(2)) : 0);
  const rowSource = marks.length > 0 ? marks : ([{}] as StudentMarkRow[]);

  return rowSource.map((mark, index) => ({
    student_id: student.id,
    row_number: index + 1,
    programme_title: header.programme_title ?? "Bachelor of Computer Applications",
    programme_code: header.programme_code ?? "BCAR",
    student_name: header.student_name ?? student.full_name,
    registration_no: header.registration_no ?? student.student_id,
    semester_label: header.semester_label ?? `Semester ${student.semester}`,
    exam_month_year: header.exam_month_year ?? "",
    issue_date: header.issue_date ?? null,
    semester_gpa: semesterGpa,
    final_grade: header.final_grade ?? "",
    total_credits: totalCredits,
    total_credit_points: totalCreditPoints,
    qr_data: header.qr_data ?? `${student.student_id}|${student.full_name}`,
    photo_url: header.photo_url ?? null,
    course_code: mark.subject_code ?? null,
    course_title: mark.subject ?? null,
    course_credits: mark.credits ?? null,
    credits_earned: mark.credits_earned ?? null,
    grade: mark.grade ?? null,
    grade_points: mark.grade_points ?? null,
    course_category: mark.course_category ?? null,
    marks_obtained: mark.marks_obtained ?? null,
    max_marks: mark.max_marks ?? null,
    subject: mark.subject ?? null,
    subject_code: mark.subject_code ?? null,
    credits: mark.credits ?? null,
    practical_1: header.practical_1 ?? null,
    ability_enhancement_compulsory_course:
      header.ability_enhancement_compulsory_course ?? null,
    skill_enhancement_course: header.skill_enhancement_course ?? null,
    practical_2: header.practical_2 ?? null,
    objective_enhancement_course: header.objective_enhancement_course ?? null,
  }));
}