import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchAllStudentMarksheets,
  normalizeMarksheet,
  resolveStudentPhotoUrl,
  type StudentMarksheet,
} from "@/lib/marksheet";
import { buildDocumentQrTarget } from "@/lib/qr-document-links";

import {
  calculateCgpaFromSemesters,
  formatCgpa,
  formatGradeWithDescriptor,
} from "./cgpa";
import {
  buildPreviewCertificateNumber,
  formatDegreeExamMonthYear,
  resolveDegreeCertificateLines,
} from "./format";
import type {
  DegreeCertificateSettings,
  DegreeCertificateStudentRow,
  DegreeCertificateView,
} from "./types";

function parseSemesterOrder(label: string): number {
  const roman: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
  };
  const trimmed = label.trim().toUpperCase();
  if (roman[trimmed]) return roman[trimmed];
  const num = parseInt(trimmed.replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

function formatIssueDateParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return {
      display: iso,
      words: iso,
    };
  }
  const day = date.getDate();
  const monthLong = date.toLocaleDateString("en-IN", { month: "long" });
  const yearWords = date.toLocaleDateString("en-IN", { year: "numeric" });
  const dayWords = [
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
    "Eighth",
    "Ninth",
    "Tenth",
    "Eleventh",
    "Twelfth",
    "Thirteenth",
    "Fourteenth",
    "Fifteenth",
    "Sixteenth",
    "Seventeenth",
    "Eighteenth",
    "Nineteenth",
    "Twentieth",
    "Twenty First",
    "Twenty Second",
    "Twenty Third",
    "Twenty Fourth",
    "Twenty Fifth",
    "Twenty Sixth",
    "Twenty Seventh",
    "Twenty Eighth",
    "Twenty Ninth",
    "Thirtieth",
    "Thirty First",
  ][day - 1] ?? String(day);
  const parenDisplay = `(${day} ${monthLong} ${yearWords})`;
  const words = `${dayWords} day of ${monthLong}, in the year ${yearWords}`;
  return {
    display: parenDisplay,
    words,
  };
}

export async function fetchDegreeCertificateSettings(
  supabase: SupabaseClient,
): Promise<DegreeCertificateSettings> {
  const { data, error } = await supabase
    .from("degree_certificate_settings")
    .select("issue_date_iso, qr_verification_base_url")
    .eq("id", 1)
    .maybeSingle();
  if (error && error.code !== "PGRST116" && error.code !== "42P01") throw error;
  return {
    issueDateIso: (data as { issue_date_iso?: string | null } | null)?.issue_date_iso ?? null,
    qrVerificationBaseUrl:
      (data as { qr_verification_base_url?: string | null } | null)?.qr_verification_base_url ??
      null,
  };
}

export async function fetchDegreeCertificateRegistry(
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ certificateNumber: string; generatedAt: string } | null> {
  const { data, error } = await supabase
    .from("degree_certificates")
    .select("certificate_number, generated_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error && error.code !== "PGRST116" && error.code !== "42P01") throw error;
  if (!data) return null;
  return {
    certificateNumber: data.certificate_number,
    generatedAt: data.generated_at,
  };
}

export async function fetchDegreeCertificateStudentRows(
  supabase: SupabaseClient,
): Promise<DegreeCertificateStudentRow[]> {
  const [{ data: marksheetRows, error: msErr }, { data: studentRows }, { data: certRows }] =
    await Promise.all([
      supabase
        .from("student_marksheets")
        .select(
          "student_id, student_name, registration_no, programme_title, programme_code, semester_label, sgpa, updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase.from("students").select("id, student_id, full_name, department"),
      supabase.from("degree_certificates").select("student_id, certificate_number"),
    ]);

  if (msErr && msErr.code !== "PGRST116") throw msErr;

  const studentsByUuid = new Map(
    ((studentRows ?? []) as { id: string; student_id: string; full_name: string; department: string }[]).map(
      (s) => [s.id, s],
    ),
  );
  const certByStudent = new Map(
    ((certRows ?? []) as { student_id: string; certificate_number: string }[]).map((c) => [
      c.student_id,
      c.certificate_number,
    ]),
  );

  type Agg = {
    studentUuid: string;
    studentName: string;
    registrationNo: string;
    programmeTitle: string;
    programmeCode: string;
    semesters: { semesterLabel: string; sgpa: number }[];
  };

  const byStudent = new Map<string, Agg>();

  for (const row of (marksheetRows ?? []) as {
    student_id: string;
    student_name: string;
    registration_no: string;
    programme_title: string;
    programme_code: string;
    semester_label: string;
    sgpa: number;
  }[]) {
    if (!row.student_id) continue;
    let agg = byStudent.get(row.student_id);
    if (!agg) {
      agg = {
        studentUuid: row.student_id,
        studentName: row.student_name,
        registrationNo: row.registration_no,
        programmeTitle: row.programme_title,
        programmeCode: row.programme_code,
        semesters: [],
      };
      byStudent.set(row.student_id, agg);
    }
    if (row.student_name) agg.studentName = row.student_name;
    if (row.registration_no) agg.registrationNo = row.registration_no;
    if (row.programme_title) agg.programmeTitle = row.programme_title;
    if (row.programme_code) agg.programmeCode = row.programme_code;
    const existingIdx = agg.semesters.findIndex(
      (s) => s.semesterLabel.toLowerCase() === String(row.semester_label).toLowerCase(),
    );
    const entry = {
      semesterLabel: row.semester_label,
      sgpa: Number(row.sgpa) || 0,
    };
    if (existingIdx >= 0) {
      agg.semesters[existingIdx] = entry;
    } else {
      agg.semesters.push(entry);
    }
  }

  const rows: DegreeCertificateStudentRow[] = [];

  for (const agg of byStudent.values()) {
    const student = studentsByUuid.get(agg.studentUuid);
    const cgpa = calculateCgpaFromSemesters(
      agg.semesters.map((s) => ({
        semesterLabel: s.semesterLabel,
        sgpa: s.sgpa,
        examMonthYear: "",
      })),
    );
    rows.push({
      studentUuid: agg.studentUuid,
      rollNo: student?.student_id ?? "—",
      fullName: agg.studentName || student?.full_name || "—",
      registrationNo: agg.registrationNo || student?.student_id || "—",
      department: student?.department ?? "—",
      programmeTitle: agg.programmeTitle || "—",
      programmeCode: agg.programmeCode || "",
      semesterCount: agg.semesters.length,
      cgpa,
      cgpaLabel: formatCgpa(cgpa),
      certificateNumber: certByStudent.get(agg.studentUuid) ?? null,
    });
  }

  rows.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  return rows;
}

export async function fetchStudentByRegistration(
  supabase: SupabaseClient,
  registrationNo: string,
): Promise<{ id: string; student_id: string } | null> {
  const reg = registrationNo.trim();
  const { data: sheet } = await supabase
    .from("student_marksheets")
    .select("student_id")
    .ilike("registration_no", reg)
    .limit(1)
    .maybeSingle();
  if (sheet?.student_id) {
    const { data: student } = await supabase
      .from("students")
      .select("id, student_id")
      .eq("id", sheet.student_id)
      .maybeSingle();
    if (student) return student as { id: string; student_id: string };
  }
  const { data: byRoll } = await supabase
    .from("students")
    .select("id, student_id")
    .ilike("student_id", reg)
    .maybeSingle();
  return (byRoll as { id: string; student_id: string } | null) ?? null;
}

async function fetchDegreeCertificateMarksheets(
  supabase: SupabaseClient,
  studentUuid: string,
): Promise<StudentMarksheet[]> {
  try {
    const sheets = await fetchAllStudentMarksheets(supabase, studentUuid);
    if (sheets.length > 0) return sheets;
  } catch (error) {
    console.warn("Degree certificate marksheet fetch failed, using direct query.", error);
  }

  const { data, error } = await supabase
    .from("student_marksheets")
    .select("*")
    .eq("student_id", studentUuid);

  if (error && error.code !== "PGRST116") throw error;
  return (data ?? []).map((row) =>
    normalizeMarksheet(row as Record<string, unknown>),
  );
}

export async function buildDegreeCertificateView(
  supabase: SupabaseClient,
  studentUuid: string,
  options?: { certificateNumber?: string | null; previewMode?: boolean },
): Promise<DegreeCertificateView | null> {
  const [studentResult, marksheets, settings, registry] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentUuid).maybeSingle(),
    fetchDegreeCertificateMarksheets(supabase, studentUuid),
    fetchDegreeCertificateSettings(supabase).catch(() => ({
      issueDateIso: null,
      qrVerificationBaseUrl: null,
    })),
    fetchDegreeCertificateRegistry(supabase, studentUuid).catch(() => null),
  ]);

  if (marksheets.length === 0) return null;

  const student =
    studentResult.data ??
    ({
      id: studentUuid,
      student_id: marksheets[marksheets.length - 1]?.student_roll_no || marksheets[marksheets.length - 1]?.registration_no,
      full_name: marksheets[marksheets.length - 1]?.student_name,
      department: "",
    } as { id: string; student_id: string; full_name: string; department?: string });

  const sorted = [...marksheets].sort(
    (a, b) => parseSemesterOrder(a.semester_label) - parseSemesterOrder(b.semester_label),
  );
  const latest = sorted[sorted.length - 1] as StudentMarksheet;
  const { degreeName, specialization } = resolveDegreeCertificateLines(
    latest.programme_title,
    (student as { department?: string }).department ?? "",
    latest.programme_code,
  );

  const semesterRecords = sorted.map((m) => ({
    semesterLabel: m.semester_label,
    sgpa: m.sgpa,
    examMonthYear: m.exam_month_year,
  }));
  const cgpa = calculateCgpaFromSemesters(semesterRecords);
  const gradeDescriptor = formatGradeWithDescriptor(cgpa);

  const issueIso =
    settings.issueDateIso ??
    latest.issue_date ??
    new Date().toISOString().slice(0, 10);
  const issueParts = formatIssueDateParts(issueIso);

  const photoUrl = await resolveStudentPhotoUrl(supabase, latest, {
    studentUuid,
  });

  return {
    studentId: studentUuid,
    studentRollNo: (student as { student_id: string }).student_id,
    studentName: latest.student_name || (student as { full_name: string }).full_name,
    registrationNo: latest.registration_no,
    degreeName,
    specialization,
    schoolName: latest.school_name,
    university: latest.university || "Garden City University",
    examMonthYear: formatDegreeExamMonthYear(latest.exam_month_year),
    cgpa,
    gradeLabel: formatCgpa(cgpa),
    gradeDescriptor,
    semesterRecords,
    photoUrl,
    certificateNumber:
      options?.certificateNumber ??
      registry?.certificateNumber ??
      (options?.previewMode
        ? buildPreviewCertificateNumber(latest.registration_no)
        : null),
    issueDateIso: issueIso,
    issueDateDisplay: issueParts.display,
    issueDateWords: issueParts.words,
  };
}

export async function allocateDegreeCertificateNumber(
  supabase: SupabaseClient,
  studentUuid: string,
  generatedBy?: string | null,
): Promise<string> {
  const existing = await fetchDegreeCertificateRegistry(supabase, studentUuid);
  if (existing) return existing.certificateNumber;

  const year = new Date().getFullYear();
  const prefix = `GCU-CONV-${year}-`;

  const { count, error: countError } = await supabase
    .from("degree_certificates")
    .select("id", { count: "exact", head: true })
    .like("certificate_number", `${prefix}%`);
  if (countError && countError.code !== "42P01") throw countError;

  const seq = (count ?? 0) + 1;
  const certificateNumber = `${prefix}${String(seq).padStart(6, "0")}`;

  const { error } = await supabase.from("degree_certificates").insert({
    student_id: studentUuid,
    certificate_number: certificateNumber,
    generated_by: generatedBy ?? null,
  });
  if (error) throw error;
  return certificateNumber;
}

export function buildDegreeDownloadUrl(registrationNo: string, origin?: string): string {
  return buildDocumentQrTarget("degree", registrationNo, origin);
}

export function buildDegreeVerificationUrl(
  certificateNumber: string,
  origin?: string,
): string {
  const base =
    origin ??
    (typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://example.com");
  const url = new URL("/degree/verify", base);
  url.searchParams.set("cert", certificateNumber.trim());
  return url.toString();
}
