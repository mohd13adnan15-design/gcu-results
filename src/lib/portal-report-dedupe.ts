import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalType } from "@/lib/types";

/** Skip inserting a second identical open report within this window. */
export const DUPLICATE_REPORT_WINDOW_MS = 20 * 60 * 1000;

/**
 * Returns true if a matching unresolved report to Super Admin was created recently
 * (same student, title, sender) — caller should block insert and show a toast.
 */
export async function hasRecentDuplicateSuperAdminReport(
  supabase: SupabaseClient,
  params: { studentId: string; title: string; senderPortal: PortalType },
): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_REPORT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("portal_notifications")
    .select("id")
    .eq("recipient_portal", "super_admin")
    .eq("student_id", params.studentId)
    .eq("title", params.title)
    .eq("sender_portal", params.senderPortal)
    .eq("is_resolved", false)
    .gte("created_at", since)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
