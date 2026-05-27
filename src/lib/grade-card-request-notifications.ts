import type { SupabaseClient } from "@supabase/supabase-js";

export const GRADE_CARD_REQUEST_NOTIFICATION_TITLE = "Grade card requested";

export function gradeCardRequestNotificationMessage(student: {
  full_name: string;
  student_id: string;
}): string {
  return `${student.full_name} (${student.student_id}) requested a grade card. Review in the Admin Queue.`;
}

/** Notify Admin (admin_2) when a student submits a grade card request. */
export async function notifyAdminGradeCardRequested(
  supabase: SupabaseClient,
  student: { id: string; full_name: string; student_id: string },
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from("portal_notifications")
    .select("id")
    .eq("recipient_portal", "admin_2")
    .eq("student_id", student.id)
    .eq("title", GRADE_CARD_REQUEST_NOTIFICATION_TITLE)
    .eq("is_resolved", false)
    .limit(1);

  if (lookupError) throw lookupError;
  if ((existing?.length ?? 0) > 0) return;

  const { error } = await supabase.from("portal_notifications").insert({
    recipient_portal: "admin_2",
    sender_portal: "fees",
    student_id: student.id,
    title: GRADE_CARD_REQUEST_NOTIFICATION_TITLE,
    message: gradeCardRequestNotificationMessage(student),
  });

  if (error) throw error;
}
