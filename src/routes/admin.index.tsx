import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { StudentMarksheet } from "@/lib/marksheet";
import { normalizeMarksheet } from "@/lib/marksheet";
import {
  buildAdminVerificationUpdate,
  calculateFeeStatus,
  getMarksheetEligibility,
  missingReasonLabel,
} from "@/lib/marksheet-verification";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import type { Student } from "@/lib/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Portal — GCU" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marksheets, setMarksheets] = useState<StudentMarksheet[]>([]);
  const [legacyMarkCount, setLegacyMarkCount] = useState<Map<string, number>>(new Map());
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"roll" | "name" | "dept">("roll");
  const [verificationFilter, setVerificationFilter] = useState<
    "all" | "pending_faculty" | "pending_admin" | "admin_done"
  >("all");

  async function load() {
    setLoading(true);
    const [
      { data: studentRows, error: studentError },
      { data: marksheetRows, error: marksheetError },
      { data: markRows, error: markErr },
    ] = await Promise.all([
      supabase.from("students").select("*").order("student_id", { ascending: true }),
      supabase.from("student_marksheets").select("*").order("updated_at", { ascending: false }),
      supabase.from("student_marks").select("student_id"),
    ]);

    if (studentError) toast.error(studentError.message);
    if (marksheetError) toast.error(marksheetError.message);
    if (markErr) toast.error(markErr.message);

    setStudents((studentRows as Student[]) ?? []);
    setMarksheets(
      ((marksheetRows as Record<string, unknown>[] | null) ?? []).map((row) =>
        normalizeMarksheet(row),
      ),
    );
    const countMap = new Map<string, number>();
    for (const row of (markRows ?? []) as { student_id: string }[]) {
      countMap.set(row.student_id, (countMap.get(row.student_id) ?? 0) + 1);
    }
    setLegacyMarkCount(countMap);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin:students-and-marksheets")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_marksheets" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const marksheetByStudentId = useMemo(
    () => new Map(marksheets.map((marksheet) => [marksheet.student_id, marksheet])),
    [marksheets],
  );

  const rows = useMemo(
    () =>
      students.map((student) => {
        const marksheet = marksheetByStudentId.get(student.id) ?? null;
        const hasLegacyMarks = (legacyMarkCount.get(student.id) ?? 0) > 0;
        const eligibility = getMarksheetEligibility({
          student,
          hasMarksheet: Boolean(marksheet) || hasLegacyMarks,
        });
        const adminReady = getMarksheetEligibility({
          student: { ...student, admin_verified: true },
          hasMarksheet: Boolean(marksheet) || hasLegacyMarks,
        }).eligible;
        return { student, marksheet, eligibility, adminReady, legacyCourseCount: legacyMarkCount.get(student.id) ?? 0 };
      }),
    [students, marksheetByStudentId, legacyMarkCount],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rows.filter(({ student }) => {
      if (!q) return true;
      return (
        student.full_name.toLowerCase().includes(q) ||
        student.student_id.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        student.department.toLowerCase().includes(q)
      );
    });

    switch (verificationFilter) {
      case "pending_faculty":
        list = list.filter(({ student }) => !student.faculty_verified);
        break;
      case "pending_admin":
        list = list.filter(({ student }) => student.faculty_verified && !student.admin_verified);
        break;
      case "admin_done":
        list = list.filter(({ student }) => student.admin_verified);
        break;
      default:
        break;
    }

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "name") {
        return a.student.full_name.localeCompare(b.student.full_name);
      }
      if (sortKey === "dept") {
        return a.student.department.localeCompare(b.student.department) ||
          a.student.student_id.localeCompare(b.student.student_id);
      }
      return a.student.student_id.localeCompare(b.student.student_id);
    });
    return sorted;
  }, [rows, searchQuery, sortKey, verificationFilter]);

  async function markAdminVerified(
    student: Student,
    marksheet: StudentMarksheet | null,
    hasLegacyMarks: boolean,
    next: boolean,
  ) {
    const hasMarksheetData = Boolean(marksheet) || hasLegacyMarks;
    const adminReady = getMarksheetEligibility({
      student: { ...student, admin_verified: true },
      hasMarksheet: hasMarksheetData,
    }).eligible;

    if (next && !adminReady) {
      toast.error("Student is not ready for Admin verification.");
      return;
    }

    setBusyStudentId(student.id);
    try {
      const { error } = await supabase
        .from("students")
        .update(
          buildAdminVerificationUpdate({
            student,
            next,
            hasMarksheet: hasMarksheetData,
          }),
        )
        .eq("id", student.id);
      if (error) throw error;
      toast.success(next ? "Admin verification complete" : "Admin verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function reportIssue(student: Student) {
    setBusyStudentId(student.id);
    try {
      const title = "Student verification issue reported";
      if (
        await hasRecentDuplicateSuperAdminReport(supabase, {
          studentId: student.id,
          title,
          senderPortal: "admin",
        })
      ) {
        toast.message("Already reported", {
          description:
            "An open report for this student was sent recently. Wait or contact Super Admin instead of reporting again.",
        });
        return;
      }

      const { error: notificationError } = await supabase.from("portal_notifications").insert({
        recipient_portal: "super_admin",
        sender_portal: "admin",
        student_id: student.id,
        title,
        message: `Please recheck fees, hostel, library, and marksheet data for ${student.student_id}.`,
      });
      if (notificationError) throw notificationError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ admin_verified: false, fully_verified: false })
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Issue reported to Super Admin");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <h2 className="text-xl font-bold text-primary">Student final verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review payments, library, hostel, and the saved marksheet before Admin verification.
      </p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll number, email, or department…"
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "roll" | "name" | "dept")}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="roll">Roll number</option>
            <option value="name">Name</option>
            <option value="dept">Department</option>
          </select>
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Verification
          <select
            value={verificationFilter}
            onChange={(e) =>
              setVerificationFilter(
                e.target.value as typeof verificationFilter,
              )
            }
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="all">All students</option>
            <option value="pending_faculty">Pending faculty</option>
            <option value="pending_admin">Pending admin</option>
            <option value="admin_done">Admin verified</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground lg:pb-2">
          Showing {filteredRows.length} of {rows.length} students
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading students and marksheets…</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Academic Fee</th>
                <th className="px-2 py-2">Hostel</th>
                <th className="px-2 py-2">Library</th>
                <th className="px-2 py-2">Marksheet</th>
                <th className="px-2 py-2">Faculty</th>
                <th className="px-2 py-2">Admin</th>
                <th className="px-2 py-2">Result</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, marksheet, eligibility, adminReady, legacyCourseCount }) => (
                <AdminStudentRow
                  key={student.id}
                  student={student}
                  marksheet={marksheet}
                  legacyCourseCount={legacyCourseCount}
                  eligibility={eligibility}
                  adminReady={adminReady}
                  busy={busyStudentId === student.id}
                  onVerify={(next) =>
                    void markAdminVerified(student, marksheet, legacyCourseCount > 0, next)
                  }
                  onReport={() => void reportIssue(student)}
                />
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No students match your search or filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminStudentRow({
  student,
  marksheet,
  legacyCourseCount,
  eligibility,
  adminReady,
  busy,
  onVerify,
  onReport,
}: {
  student: Student;
  marksheet: StudentMarksheet | null;
  legacyCourseCount: number;
  eligibility: ReturnType<typeof getMarksheetEligibility>;
  adminReady: boolean;
  busy: boolean;
  onVerify: (next: boolean) => void;
  onReport: () => void;
}) {
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
    <tr className="border-b border-border/60 align-top">
      <td className="px-2 py-3">
        <p className="font-medium text-primary">{student.full_name}</p>
        <p className="text-xs text-muted-foreground">{student.student_id}</p>
      </td>
      <td className="px-2 py-3">
        <StatusText ok={academic.cleared} label={academic.cleared ? "Clear" : "Pending"} />
        <p className="mt-1 text-xs text-muted-foreground">
          Rs. {academic.paid.toLocaleString()} / Rs. {academic.total.toLocaleString()}
        </p>
      </td>
      <td className="px-2 py-3">
        <StatusText
          ok={hostel.cleared}
          label={!student.in_hostel ? "Not enrolled" : hostel.cleared ? "Clear" : "Pending"}
        />
        {student.in_hostel && (
          <p className="mt-1 text-xs text-muted-foreground">
            Rs. {hostel.paid.toLocaleString()} / Rs. {hostel.total.toLocaleString()}
          </p>
        )}
      </td>
      <td className="px-2 py-3">
        <StatusText
          ok={!student.in_library || student.library_cleared}
          label={
            !student.in_library ? "Not enrolled" : student.library_cleared ? "Clear" : "Pending"
          }
        />
      </td>
      <td className="px-2 py-3">
        {marksheet ? (
          <div>
            <p className="font-medium text-primary">
              {marksheet.programme_code} · Sem {marksheet.semester_label}
            </p>
            <p className="text-xs text-muted-foreground">
              {marksheet.courses.length} courses · SGPA {marksheet.sgpa.toFixed(2)} ·{" "}
              {marksheet.final_grade}
            </p>
          </div>
        ) : legacyCourseCount > 0 ? (
          <div>
            <p className="font-medium text-primary">Subject marks · {legacyCourseCount} courses</p>
            <p className="text-xs text-muted-foreground">Saved via bulk upload / Super Admin</p>
          </div>
        ) : (
          <StatusText ok={false} label="Missing" />
        )}
      </td>
      <td className="px-2 py-3">
        <StatusText
          ok={Boolean(student.faculty_verified)}
          label={student.faculty_verified ? "Verified" : "Pending"}
        />
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={Boolean(student.admin_verified)}
          disabled={busy || (!student.admin_verified && !adminReady)}
          onChange={(event) => onVerify(event.target.checked)}
          aria-label={`Admin verification for ${student.student_id}`}
        />
      </td>
      <td className="px-2 py-3">
        <StatusText
          ok={eligibility.eligible}
          label={eligibility.eligible ? "Unlocked" : "Locked"}
        />
        {!eligibility.eligible && (
          <p className="mt-1 max-w-44 text-xs text-muted-foreground">
            {eligibility.missing.map(missingReasonLabel).join(", ")}
          </p>
        )}
      </td>
      <td className="px-2 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onReport}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary disabled:opacity-60"
          >
            <MessageSquareWarning className="h-3.5 w-3.5" /> Report
          </button>
          <Link
            to="/admin/students/$studentId"
            params={{ studentId: student.id }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Link>
        </div>
      </td>
    </tr>
  );
}

function StatusText({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "font-medium text-primary" : "font-medium text-amber-700"}>{label}</span>
  );
}
