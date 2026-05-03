// Tiny client-side session helpers (localStorage based — demo).
import type { PortalType } from "./types";

const ADMIN_KEY = "gcu_admin_session";
const STUDENT_KEY = "gcu_student_session";

export interface AdminSession {
  id: string;
  username: string;
  portal: PortalType;
}
export interface StudentSession {
  id: string;
  student_id: string;
  email: string;
  full_name: string;
  verified?: boolean;
}

export function setAdminSession(s: AdminSession) {
  if (typeof window !== "undefined") localStorage.setItem(ADMIN_KEY, JSON.stringify(s));
}
export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? (JSON.parse(raw) as AdminSession) : null;
}
export function clearAdminSession() {
  if (typeof window !== "undefined") localStorage.removeItem(ADMIN_KEY);
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
