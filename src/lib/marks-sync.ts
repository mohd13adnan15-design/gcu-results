import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "@/integrations/supabase/types";
import type { LegacyMarkRow, StudentMarksheet } from "@/lib/marksheet";
import {
  calculateMarksheetTotals,
  fetchStudentMarksheet,
  legacyMarkRowsToMarksheetCourses,
} from "@/lib/marksheet";

/**
 * Writes computed SGPA / totals to `grade_card_details` and the full JSON marksheet to
 * `student_marksheets` so the student PDF flow and headers (university, school, grade card no)
 * stay aligned with `student_marks`.
 */
export async function syncStudentGradeAndMarksheet(
  supabase: SupabaseClient,
  studentId: string,
  overrides?: Partial<
    Pick<
      StudentMarksheet,
      | "university"
      | "school_name"
      | "grade_card_no"
      | "qr_data"
      | "exam_month_year"
      | "issue_date"
      | "programme_title"
      | "programme_code"
      | "student_name"
      | "registration_no"
      | "semester_label"
    >
  >,
): Promise<void> {
  const base = await fetchStudentMarksheet(supabase, studentId);
  if (!base) return;

  const { data: marksRows } = await supabase
    .from("student_marks")
    .select(
      "subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  const marks = ((marksRows as LegacyMarkRow[] | null) ?? []).filter(Boolean);

  let merged: StudentMarksheet = { ...base, ...overrides };

  if (marks.length > 0) {
    const courses = legacyMarkRowsToMarksheetCourses(marks);
    const totals = calculateMarksheetTotals(courses);
    merged = {
      ...merged,
      ...overrides,
      courses,
      total_credits: totals.totalCredits,
      total_credits_earned: totals.totalCreditsEarned,
      total_credit_points: totals.totalCreditPoints,
      sgpa: totals.sgpa,
      final_grade: totals.finalGrade,
    };
  }

  const now = new Date().toISOString();

  const { error: msErr } = await supabase.from("student_marksheets").upsert(
    {
      student_id: studentId,
      student_roll_no: merged.student_roll_no,
      university: merged.university,
      school_name: merged.school_name,
      programme_title: merged.programme_title,
      programme_code: merged.programme_code,
      student_name: merged.student_name,
      registration_no: merged.registration_no,
      semester_label: merged.semester_label,
      exam_month_year: merged.exam_month_year,
      issue_date: merged.issue_date,
      grade_card_no: merged.grade_card_no,
      qr_data: merged.qr_data,
      photo_bucket: merged.photo_bucket,
      photo_path: merged.photo_path,
      total_credits: merged.total_credits,
      total_credits_earned: merged.total_credits_earned,
      total_credit_points: merged.total_credit_points,
      sgpa: merged.sgpa,
      final_grade: merged.final_grade,
      courses: merged.courses as unknown as Json,
      updated_at: now,
    },
    { onConflict: "student_id" },
  );
  if (msErr) throw msErr;

  const { error: gcErr } = await supabase.from("grade_card_details").upsert(
    {
      student_id: studentId,
      student_name: merged.student_name,
      programme_title: merged.programme_title,
      programme_code: merged.programme_code,
      registration_no: merged.registration_no,
      semester_label: merged.semester_label,
      exam_month_year: merged.exam_month_year,
      issue_date: merged.issue_date,
      semester_gpa: merged.sgpa,
      final_grade: merged.final_grade,
      updated_at: now,
      created_at: now,
    },
    { onConflict: "student_id" },
  );
  if (gcErr) throw gcErr;
}
