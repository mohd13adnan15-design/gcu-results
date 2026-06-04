import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentProfilePatch = {
  full_name?: string;
  email?: string;
  student_id?: string;
  department?: string;
};

/** Push COE profile edits into grade cards, marksheets, and related tables. */
export async function propagateStudentProfileToRelatedTables(
  supabase: SupabaseClient,
  studentUuid: string,
  patch: StudentProfilePatch,
): Promise<{ error: string | null }> {
  const name = patch.full_name?.trim();
  const roll = patch.student_id?.trim();
  const dept = patch.department?.trim();

  if (name) {
    const { error: gcdErr } = await supabase
      .from("grade_card_details")
      .update({ student_name: name, updated_at: new Date().toISOString() })
      .eq("student_id", studentUuid);
    if (gcdErr) return { error: gcdErr.message };

    const { error: mgcErr } = await supabase
      .from("main_grade_card")
      .update({ student_name: name, updated_at: new Date().toISOString() })
      .eq("student_id", studentUuid);
    if (mgcErr) return { error: mgcErr.message };

    const { error: msErr } = await supabase
      .from("student_marksheets")
      .update({ student_name: name, updated_at: new Date().toISOString() })
      .eq("student_id", studentUuid);
    if (msErr) return { error: msErr.message };
  }

  if (roll) {
    const { error: msRollErr } = await supabase
      .from("student_marksheets")
      .update({
        student_roll_no: roll,
        registration_no: roll,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentUuid);
    if (msRollErr) return { error: msRollErr.message };

    const { error: gcdRollErr } = await supabase
      .from("grade_card_details")
      .update({ registration_no: roll, updated_at: new Date().toISOString() })
      .eq("student_id", studentUuid);
    if (gcdRollErr) return { error: gcdRollErr.message };

    const { error: mgcRollErr } = await supabase
      .from("main_grade_card")
      .update({ registration_no: roll, updated_at: new Date().toISOString() })
      .eq("student_id", studentUuid);
    if (mgcRollErr) return { error: mgcRollErr.message };
  }

  if (dept) {
    const { error: mgcDeptErr } = await supabase
      .from("main_grade_card")
      .update({ programme_code: dept })
      .eq("student_id", studentUuid);
    if (mgcDeptErr) return { error: mgcDeptErr.message };
  }

  return { error: null };
}
