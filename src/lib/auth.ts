// Session helpers: staff use Supabase Auth + `portal_profiles`; students use Auth + `students.auth_user_id`.
import type { PortalType } from "./types";
import { supabase } from "@/integrations/supabase/client";

const STUDENT_KEY = "gcu_student_session";

export interface AdminSession {
  userId: string;
  email: string;
  portal: PortalType;
}

export interface StudentSession {
  id: string;
  student_id: string;
  email: string;
  full_name: string;
  verified?: boolean;
}

/** Ends Supabase session and clears cached student snapshot in localStorage. */
export async function signOutEverywhere() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") localStorage.removeItem(STUDENT_KEY);
}

export function setStudentSession(s: StudentSession) {
  if (typeof window !== "undefined") localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
}
export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STUDENT_KEY);
  return raw ? (JSON.parse(raw) as StudentSession) : null;
}
export function clearStudentSession() {
  if (typeof window !== "undefined") localStorage.removeItem(STUDENT_KEY);
}
