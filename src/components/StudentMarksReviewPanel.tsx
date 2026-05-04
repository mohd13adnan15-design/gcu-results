import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { StudentMarksheet } from "@/lib/marksheet";
import { fetchStudentMarksheet } from "@/lib/marksheet";
import { MarksheetSavedPreview } from "@/components/MarksheetDisplay";
import {
  buildAdminVerificationUpdate,
  buildFacultyVerificationUpdate,
  calculateFeeStatus,
  getMarksheetEligibility,
  missingReasonLabel,
} from "@/lib/marksheet-verification";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import type { Student } from "@/lib/types";

type PortalMode = "faculty" | "admin";

type Props = {
  studentId: string;
  portal: PortalMode;
};

export function StudentMarksReviewPanel({ studentId, portal }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [marksheet, setMarksheet] = useState<StudentMarksheet | null>(null);
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
      setPageLoading(false);
      return;
    }

    const nextStudent = (studentData as Student | null) ?? null;
    setStudent(nextStudent);
    if (!nextStudent) {
      setMarksheet(null);
      setPageLoading(false);
      return;
    }

    try {
      setMarksheet(await fetchStudentMarksheet(supabase, nextStudent.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load marksheet");
      setMarksheet(null);
    } finally {
      setPageLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`${portal}:student-marksheet:${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `id=eq.${studentId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_marksheets",
          filter: `student_id=eq.${studentId}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_marks",
          filter: `student_id=eq.${studentId}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grade_card_details",
          filter: `student_id=eq.${studentId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
        portal === "faculty"
          ? `Please recheck the marksheet for ${student.full_name} (${student.student_id}).`
          : `Please recheck fees, library, hostel, and marksheet data for ${student.full_name} (${student.student_id}).`;

      const title =
        portal === "faculty" ? "Marksheet issue reported" : "Student verification issue reported";

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
        recipient_portal: "super_admin",
        sender_portal: portal,
        student_id: student.id,
        title,
        message: note.trim() || fallback,
      });
      if (notificationError) throw notificationError;

      const verificationPayload =
        portal === "faculty"
          ? buildFacultyVerificationUpdate(false)
          : { admin_verified: false, fully_verified: false };
      const { error: studentError } = await supabase
        .from("students")
        .update(verificationPayload)
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Issue reported to Super Admin");
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
    setVerifyBusy(true);
    try {
      const { error } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(next))
        .eq("id", student.id);
      if (error) throw error;

      if (next) {
        await supabase.from("portal_notifications").insert({
          recipient_portal: "admin",
          sender_portal: "faculty",
          student_id: student.id,
          title: "Faculty marksheet verification complete",
          message: `${student.student_id} was verified by Faculty and is ready for Admin review.`,
        });
      }

      toast.success(next ? "Faculty verified marksheet" : "Faculty verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function toggleAdminVerified(next: boolean) {
    if (!student) return;
    setVerifyBusy(true);
    try {
      const payload = buildAdminVerificationUpdate({
        student,
        next,
        hasMarksheet: Boolean(marksheet),
      });
      const { error } = await supabase.from("students").update(payload).eq("id", student.id);
      if (error) throw error;
      toast.success(next ? "Admin verification complete" : "Admin verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
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

  const facultyCanVerify = Boolean(marksheet);
  const adminCanVerify =
    Boolean(marksheet) &&
    Boolean(eligibility?.feesOk) &&
    Boolean(eligibility?.hostelOk) &&
    Boolean(eligibility?.libraryOk) &&
    Boolean(student.faculty_verified);

  return (
    <div className="space-y-6">
      <Link
        to={portal === "faculty" ? "/faculty" : "/admin"}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="card-elevated rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <StudentIdentity student={student} />
          <VerificationSummary
            portal={portal}
            student={student}
            marksheet={marksheet}
            eligibility={eligibility}
          />
        </div>

        {portal === "admin" && <AdminClearanceReview student={student} />}

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-primary">Saved marksheet (student_marksheets)</p>
          <MarksheetSavedPreview
            marksheet={marksheet}
            readOnlyNotice={portal === "admin"}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-cream p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              {portal === "faculty" ? "Faculty marksheet verification" : "Admin final verification"}
            </p>
            <p className="text-xs text-muted-foreground">
              {portal === "faculty"
                ? "Verify only after checking the saved marksheet."
                : "Verify only after checking fees, hostel, library, and marksheet."}
            </p>
          </div>
          {portal === "faculty" ? (
            <button
              type="button"
              onClick={() => void toggleFacultyVerified(!student.faculty_verified)}
              disabled={!facultyCanVerify || verifyBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {student.faculty_verified ? "Remove Verification" : "Verify Marksheet"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void toggleAdminVerified(!student.admin_verified)}
              disabled={!adminCanVerify || verifyBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {student.admin_verified ? "Remove Verification" : "Verify Student"}
            </button>
          )}
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-cream p-4">
          <label className="block text-sm font-medium text-primary">
            Report mistake to Super Admin
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                portal === "faculty"
                  ? "Describe the marksheet issue"
                  : "Describe the fee, hostel, library, or marksheet issue"
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
        {student.department} · Semester {student.semester} · Year {student.year}
      </p>
    </div>
  );
}

function VerificationSummary({
  portal,
  student,
  marksheet,
  eligibility,
}: {
  portal: PortalMode;
  student: Student;
  marksheet: StudentMarksheet | null;
  eligibility: ReturnType<typeof getMarksheetEligibility> | null;
}) {
  const pending = eligibility?.missing ?? [];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm">
      <p>
        Marksheet: <strong>{marksheet ? "Available" : "Missing"}</strong>
      </p>
      <p>
        Faculty: <strong>{student.faculty_verified ? "Verified" : "Pending"}</strong>
      </p>
      {portal === "admin" && (
        <p>
          Admin: <strong>{student.admin_verified ? "Verified" : "Pending"}</strong>
        </p>
      )}
      {pending.length > 0 ? (
        <p className="mt-2 max-w-xs text-xs text-muted-foreground">
          Pending: {pending.map(missingReasonLabel).join(", ")}
        </p>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
        </p>
      )}
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
          !student.in_library ? "Not enrolled" : student.library_cleared ? "Clear" : "Pending"
        }
        lines={
          student.in_library
            ? [
                student.library_remote_profile_id
                  ? `Remote profile ${student.library_remote_profile_id}`
                  : "No remote profile linked",
              ]
            : ["No library clearance required"]
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

