import type { Student } from "@/lib/types";
import { getLibraryRemoteClient } from "@/integrations/supabase/library-remote-client";

/** Rows from external library project's `public.penalties` table. */
export interface LibraryPenaltyRow {
  id: string;
  student_id: string;
  issued_book_id: string;
  days_overdue: number;
  fine_per_day: number;
  total_fine: number;
  status: string;
  calculated_at: string;
  paid_at: string | null;
  created_at: string;
}

export function resolveLibraryRemoteProfileId(student: Student): string | null {
  const fromCol = student.library_remote_profile_id?.trim();
  if (fromCol) return fromCol;

  const raw = import.meta.env.VITE_LIBRARY_PROFILE_MAP_JSON as string | undefined;
  if (!raw?.trim()) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const id = map[student.email.trim().toLowerCase()];
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchLibraryPenalties(
  libraryProfileId: string,
): Promise<LibraryPenaltyRow[]> {
  const sb = getLibraryRemoteClient();
  const { data, error } = await sb
    .from("penalties")
    .select(
      "id, student_id, issued_book_id, days_overdue, fine_per_day, total_fine, status, calculated_at, paid_at, created_at",
    )
    .eq("student_id", libraryProfileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryPenaltyRow[];
}

export function getOutstandingPenaltyTotal(rows: LibraryPenaltyRow[]): number {
  return rows
    .filter((r) => r.status !== "paid")
    .reduce((sum, r) => sum + Number(r.total_fine ?? 0), 0);
}
