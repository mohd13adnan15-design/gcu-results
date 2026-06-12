import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { subscribePostgresChanges } from "@/lib/supabase-realtime";
import type { StudentMarksheet } from "@/lib/marksheet";
import { fetchStudentMarksheet, fetchAllStudentMarksheets, calculateMarksheetTotals } from "@/lib/marksheet";
import { MarksheetSavedPreview } from "@/features/marks/MarksheetDisplay";
import {
  buildAdminVerificationUpdate,
  buildFacultyVerificationUpdate,
  calculateFeeStatus,
  getMarksheetEligibility,
  missingReasonLabel,
} from "@/lib/marksheet-verification";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import type { Student } from "@/lib/types";

function getSemesterNumber(label: string): number {
  const clean = (label || "").toUpperCase().trim();
  if (clean.includes("VIII") || clean.includes("8")) return 8;
  if (clean.includes("VII") || clean.includes("7")) return 7;
  if (clean.includes("VI") || clean.includes("6")) return 6;
  if (clean.includes("IV") || clean.includes("4")) return 4;
  if (clean.includes("III") || clean.includes("3")) return 3;
  if (clean.includes("II") || clean.includes("2")) return 2;
  if (clean.includes("I") || clean.includes("1")) return 1;
  if (clean.includes("V") || clean.includes("5")) return 5;
  return 1;
}

function getFilteredMarksheet(
  currentSheet: StudentMarksheet | null,
  allSheets: StudentMarksheet[],
  showAll: boolean
): StudentMarksheet | null {
  if (!currentSheet) return null;
  if (showAll) {
    const sorted = [...allSheets].sort((a, b) =>
      getSemesterNumber(b.semester_label) - getSemesterNumber(a.semester_label)
    );
    const latest = sorted[0] || currentSheet;
    const reindexedCourses = (latest.courses || []).map((c, i) => ({
      ...c,
      sl_no: i + 1,
    }));
    const totals = calculateMarksheetTotals(reindexedCourses);
    return {
      ...latest,
      courses: reindexedCourses,
      total_credits: totals.totalCredits,
      total_credits_earned: totals.totalCreditsEarned,
      total_credit_points: totals.totalCreditPoints,
      sgpa: totals.sgpa,
      final_grade: totals.finalGrade,
    };
  }

  const currentSemNum = getSemesterNumber(currentSheet.semester_label);
  const previousCourseCodes = new Set<string>();

  for (const sheet of allSheets) {
    if (getSemesterNumber(sheet.semester_label) < currentSemNum) {
      const courses = Array.isArray(sheet.courses) ? sheet.courses : [];
      for (const c of courses) {
        const code = String((c as any).course_code || (c as any).subject_code || "").toUpperCase().trim();
        if (code) previousCourseCodes.add(code);
      }
    }
  }

  const rawCourses = Array.isArray(currentSheet.courses) ? currentSheet.courses : [];
  const filteredCourses = rawCourses.filter((c) => {
    const code = String((c as any).course_code || (c as any).subject_code || "").toUpperCase().trim();
    return !previousCourseCodes.has(code);
  });

  const reindexedCourses = filteredCourses.map((c, i) => ({
    ...c,
    sl_no: i + 1,
  }));

  const totals = calculateMarksheetTotals(reindexedCourses);

  return {
    ...currentSheet,
    courses: reindexedCourses,
    total_credits: totals.totalCredits,
    total_credits_earned: totals.totalCreditsEarned,
    total_credit_points: totals.totalCreditPoints,
    sgpa: totals.sgpa,
    final_grade: totals.finalGrade,
  };
}

type PortalMode = "head_of_coe" | "admin";

type Props = {
  studentId: string;
  portal: PortalMode;
  /** When false, hides the combined "All Sem" grade view (Admin portal). */
  showAllSemestersButton?: boolean;
};

export function StudentMarksReviewPanel({
  studentId,
  portal,
  showAllSemestersButton = false,
}: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
  const [allMarksheets, setAllMarksheets] = useState<StudentMarksheet[]>([]);
  const [selectedSemLabel, setSelectedSemLabel] = useState<string | null>(null);
  const [showAllSemesters, setShowAllSemesters] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const load = useCallback(async () => {
    setPageLoading(true);
    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();
    if (studentError) {
      toast.error(studentError.message);
      setStudent(null);
      setMarksheet(null);
      setAllMarksheets([]);
      setSelectedSemLabel(null);
      setShowAllSemesters(false);
      setPageLoading(false);
      return;
    }

    const nextStudent = (studentData as Student | null) ?? null;
    setStudent(nextStudent);
    if (!nextStudent) {
      setMarksheet(null);
      setAllMarksheets([]);
      setSelectedSemLabel(null);
      setShowAllSemesters(false);
      setPageLoading(false);
      return;
    }

    try {
      const sheets = await fetchAllStudentMarksheets(supabase, nextStudent.id);
      setAllMarksheets(sheets);
      if (sheets.length > 0) {
        // Default to showing the latest saved marksheet
        const latest = sheets[sheets.length - 1];
        setMarksheet(latest);
        setSelectedSemLabel(latest.semester_label);
        setShowAllSemesters(false);
      } else {
        setMarksheet(null);
        setSelectedSemLabel(null);
        setShowAllSemesters(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load marksheet");
      setMarksheet(null);
      setAllMarksheets([]);
      setSelectedSemLabel(null);
      setShowAllSemesters(false);
    } finally {
      setPageLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
    return subscribePostgresChanges(
      `${portal}:student-marksheet:${studentId}`,
      [
        { event: "*", schema: "public", table: "students", filter: `id=eq.${studentId}` },
        {
          event: "*",
          schema: "public",
          table: "student_marksheets",
          filter: `student_id=eq.${studentId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "student_marks",
          filter: `student_id=eq.${studentId}`,
        },
        {
          event: "*",
          schema: "public",
          table: "grade_card_details",
          filter: `student_id=eq.${studentId}`,
        },
      ],
      () => void load(),
    );
  }, [load, portal, studentId]);

  const eligibility = useMemo(() => {
    if (!student) return null;
    return getMarksheetEligibility({
      student,
      hasMarksheet: Boolean(marksheet),
      hasLibraryPenalty: false,
    });
  }, [student, marksheet]);

  async function reportIssue() {
    if (!student) return;
    setBusy(true);
    try {
      const fallback =
        portal === "head_of_coe"
          ? `Please recheck and edit grade card data for ${student.full_name} (${student.student_id}).`
          : `Please recheck fees, library, hostel, and grade card data for ${student.full_name} (${student.student_id}).`;

      const title =
        portal === "head_of_coe"
          ? "Admin reported a mismatch"
          : "Student verification issue reported";

      if (
        await hasRecentDuplicateSuperAdminReport(supabase, {
          studentId: student.id,
          title,
          senderPortal: portal,
        })
      ) {
        toast.message("Already reported", {
          description:
            "An open report for this student was sent recently. Edit your note or wait before reporting again.",
        });
        return;
      }

      const { error: notificationError } = await supabase.from("portal_notifications").insert({
        recipient_portal: "head_of_coe",
        sender_portal: portal,
        student_id: student.id,
        title,
        message: note.trim() || fallback,
      });
      if (notificationError) throw notificationError;

      const verificationPayload =
        portal === "head_of_coe"
          ? buildFacultyVerificationUpdate(false)
          : { admin_verified: false, fully_verified: false };
      const { error: studentError } = await supabase
        .from("students")
        .update(verificationPayload)
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Issue reported");
      setNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFacultyVerified(next: boolean) {
    if (!student || !marksheet) return;
    if (next && !student.marksheet_verification_requested_at) {
      toast.error("This student has not requested grade card verification from their portal yet.");
      return;
    }
    setVerifyBusy(true);
    try {
      const { error } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(next))
        .eq("id", student.id);
      if (error) throw error;

      if (next) {
        await supabase.from("portal_notifications").insert({
          recipient_portal: "head_of_coe",
          sender_portal: "head_of_coe",
          student_id: student.id,
          title: "Admin verification complete",
          message: `${student.student_id} was verified.`,
        });
      }

      toast.success(next ? "Admin verification complete" : "Admin verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin verification update failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function toggleAdminVerified(next: boolean) {
    if (!student) return;
    if (next && !student.marksheet_verification_requested_at) {
      toast.error("This student has not requested grade card verification from their portal yet.");
      return;
    }
    if (next && !student.faculty_verified) {
      toast.error("Verification must be completed before issuing grade card.");
      return;
    }
    setVerifyBusy(true);
    try {
      const payload = buildAdminVerificationUpdate({
        student,
        next,
        hasMarksheet: Boolean(marksheet),
      });
      const { error } = await supabase.from("students").update(payload).eq("id", student.id);
      if (error) throw error;
      toast.success(next ? "Grade card issued for student" : "Grade card revoked");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin verification update failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="card-elevated rounded-2xl p-6">
          <div className="space-y-3">
            <div className="h-6 w-64 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted/80" />
            <div className="h-32 animate-pulse rounded-lg bg-muted/60" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Loading student and marks data…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <p className="text-sm text-muted-foreground">
        No student found for this link. Go back and pick a student from the list.
      </p>
    );
  }

  const facultyCanVerify =
    Boolean(marksheet) &&
    (Boolean(student.faculty_verified) || Boolean(student.marksheet_verification_requested_at));
  const adminCanVerify =
    Boolean(marksheet) &&
    Boolean(eligibility?.feesOk) &&
    Boolean(eligibility?.hostelOk) &&
    Boolean(eligibility?.libraryOk) &&
    (Boolean(student.admin_verified) ||
      (Boolean(student.faculty_verified) && Boolean(student.marksheet_verification_requested_at)));

  return (
    <div className="space-y-6">
      <Link
        to={portal === "head_of_coe" ? "/coe" : "/admin"}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="card-elevated rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <StudentIdentity student={student} />
        </div>

        {portal === "admin" && <AdminClearanceReview student={student} />}

        <div className="mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3 border-b border-border/40 pb-2">
            <p className="text-sm font-semibold text-primary">
              Grade card Details
            </p>
            {allMarksheets.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {allMarksheets.map((m) => {
                  const semName = (m.semester_label || "").toLowerCase().startsWith("sem")
                    ? m.semester_label
                    : `Sem ${m.semester_label}`;
                  const isSelected = !showAllSemesters && selectedSemLabel === m.semester_label;
                  return (
                    <button
                      key={m.id || m.semester_label}
                      type="button"
                      onClick={() => {
                        setMarksheet(m);
                        setSelectedSemLabel(m.semester_label);
                        setShowAllSemesters(false);
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-primary border-primary/30 hover:bg-primary/10"
                      }`}
                    >
                      {semName}
                    </button>
                  );
                })}
                {showAllSemestersButton && (
                  <button
                    type="button"
                    onClick={() => setShowAllSemesters(true)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition ${
                      showAllSemesters
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-primary border-primary/30 hover:bg-primary/10"
                    }`}
                  >
                    All Sem
                  </button>
                )}
              </div>
            )}
          </div>
          <MarksheetSavedPreview marksheet={getFilteredMarksheet(marksheet, allMarksheets, showAllSemesters)} />
        </div>

        {portal === "head_of_coe" && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-cream p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">
                Admin · Grade Card review
              </p>
              <p className="text-xs text-muted-foreground">
                Admin check and verify after checking saved grade card.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleFacultyVerified(!student.faculty_verified)}
              disabled={!facultyCanVerify || verifyBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {student.faculty_verified ? "Remove Verification" : "Verify Grade Card"}
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-cream p-4">
          <label className="block text-sm font-medium text-primary">
            {portal === "head_of_coe" ? "Report mismatch" : "Report issue"}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                portal === "head_of_coe"
                  ? "Describe the mismatch and required edits"
                  : "Describe the fee, hostel, library, or grade card issue"
              }
              className="mt-2 min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => void reportIssue()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-secondary disabled:opacity-60"
          >
            <MessageSquareWarning className="h-4 w-4" />
            {busy ? "Sending..." : "Report Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentIdentity({ student }: { student: Student }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-primary">{student.full_name}</h2>
      <p className="text-sm text-muted-foreground">{student.student_id}</p>
      <p className="text-sm text-muted-foreground">{student.email}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {student.department}
      </p>
    </div>
  );
}


function AdminClearanceReview({ student }: { student: Student }) {
  const academic = calculateFeeStatus({
    paid: student.fees_paid,
    total: student.fees_total,
    cleared: student.fees_cleared,
  });
  const hostel = calculateFeeStatus({
    paid: student.hostel_paid,
    total: student.hostel_total,
    cleared: !student.in_hostel || student.hostel_cleared,
  });

  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      <ClearanceBox
        label="Academic Fee"
        status={academic.cleared ? "Clear" : "Pending"}
        lines={[
          `Paid Rs. ${academic.paid.toLocaleString()} / Rs. ${academic.total.toLocaleString()}`,
          `Pending Rs. ${academic.pending.toLocaleString()}`,
        ]}
        ok={academic.cleared}
      />
      <ClearanceBox
        label="Hostel Fee"
        status={!student.in_hostel ? "Not enrolled" : hostel.cleared ? "Clear" : "Pending"}
        lines={
          student.in_hostel
            ? [
              `Paid Rs. ${hostel.paid.toLocaleString()} / Rs. ${hostel.total.toLocaleString()}`,
              `Pending Rs. ${hostel.pending.toLocaleString()}`,
            ]
            : ["No hostel clearance required"]
        }
        ok={hostel.cleared}
      />
      <ClearanceBox
        label="Library"
        status={
          !student.in_library ? "Clear" : student.library_cleared ? "Clear" : "Pending"
        }
        lines={
          student.in_library
            ? student.library_cleared
              ? ["All Books Returned, No penalties"]
              : ["Library clearance pending"]
            : ["No Penalty"]
        }
        ok={!student.in_library || student.library_cleared}
      />
    </div>
  );
}

function ClearanceBox({
  label,
  status,
  lines,
  ok,
}: {
  label: string;
  status: string;
  lines: string[];
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white/70 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-primary">{label}</p>
        <span className={`text-xs font-medium ${ok ? "text-primary" : "text-amber-700"}`}>
          {status}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

