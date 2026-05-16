export type PortalType = "head_of_coe" | "admin_1" | "admin_2" | "library" | "hostel" | "fees";

export interface Student {
  id: string;
  student_id: string;
  email: string;
  full_name: string;
  /** Set when the student signs in with Supabase Auth (matches `auth.users.id`). */
  auth_user_id?: string | null;
  department: string;
  semester: number;
  year: number;
  in_library: boolean;
  in_hostel: boolean;
  in_fees: boolean;
  library_cleared: boolean;
  hostel_cleared: boolean;
  fees_cleared: boolean;
  faculty_verified?: boolean;
  admin_verified?: boolean;
  fully_verified?: boolean;
  /** ISO timestamp when the student requested marksheet verification (faculty/admin queues). */
  marksheet_verification_requested_at?: string | null;
  /** ISO timestamp when COE uploaded the marks to trigger the 48-hour SLA timer. */
  marks_uploaded_at?: string | null;
  /** Date selected by Admin to be printed on the Grade Card. */
  grade_card_issue_date?: string | null;
  fees_total: number;
  fees_paid: number;
  hostel_total: number;
  hostel_paid: number;
  /** UUID of `profiles.id` in the external library Supabase project - for penalty sync. */
  library_remote_profile_id?: string | null;
}

export interface StudentMarkRow {
  subject: string;
  subject_code: string;
  course_category?: string;
  credits: number;
  credits_earned?: number;
  marks_obtained: number;
  max_marks: number;
  grade: string;
  grade_points?: number;
}

export interface StudentGradeProfile {
  programme_title: string;
  programme_code: string;
  registration_no: string;
  exam_month_year: string;
  issue_date: string;
  semester_label: string;
  total_credits: number;
  total_credits_earned: number;
  total_credit_points: number;
  semester_gpa: number;
  final_grade: string;
}

export const DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL"] as const;
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const YEARS = [1, 2, 3, 4] as const;
