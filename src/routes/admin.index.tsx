import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Eye, Loader2, MessageSquareWarning, ShieldCheck, X, Bell } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { subscribePostgresChanges } from "@/lib/supabase-realtime";
import type { StudentMarksheet } from "@/lib/marksheet";
import {
  normalizeMarksheet,
  fetchStudentMarksheet,
  fetchAllStudentMarksheets,
  resolveStudentPhotoUrl,
} from "@/lib/marksheet";
import { GradeCardPreviewViewer } from "@/features/marks/GradeCardPreviewViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildAdminVerificationUpdate,
  buildFacultyVerificationUpdate,
} from "@/lib/marksheet-verification";
import { syncStudentGradeAndMarksheet } from "@/lib/marks-sync";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import { GRADE_CARD_REQUEST_NOTIFICATION_TITLE } from "@/lib/grade-card-request-notifications";
import type { Student } from "@/lib/types";

type GradeCardRequestNotification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  student_id: string | null;
};

export function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marksheets, setMarksheets] = useState<StudentMarksheet[]>([]);
  const [studentMarks, setStudentMarks] = useState<{ student_id: string; subject_code: string | null; subject: string | null }[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"request" | "roll" | "name" | "dept">("request");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "pending" | "done">("all");
  const [unresolvedReports, setUnresolvedReports] = useState<Set<string>>(new Set());
  const [gradeCardRequestNotifications, setGradeCardRequestNotifications] = useState<
    GradeCardRequestNotification[]
  >([]);
  const [previewConfirmedIds, setPreviewConfirmedIds] = useState<Set<string>>(new Set());
  const [issueModal, setIssueModal] = useState<{
    student: Student;
    marksheet: StudentMarksheet | null;
    legacyCourseCount: number;
  } | null>(null);

  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewMarksheet, setPreviewMarksheet] = useState<StudentMarksheet | null>(null);
  const [previewAllSheets, setPreviewAllSheets] = useState<StudentMarksheet[]>([]);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAllSemesters, setShowAllSemesters] = useState(false);

  async function handleConfirmPreview() {
    if (!previewStudent) return;
    setPreviewConfirmedIds((prev) => new Set(prev).add(previewStudent.id));
    toast.success("Preview confirmed. You can now issue the grade card.");
  }

  function formatRequestDate(value: string | null | undefined) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleOpenPreview(student: Student) {
    setPreviewStudent(student);
    setPreviewLoading(true);
    setPreviewMarksheet(null);
    setPreviewAllSheets([]);
    setPreviewPhotoUrl(null);
    setShowAllSemesters(false);
    try {
      const sheets = await fetchAllStudentMarksheets(supabase, student.id);
      setPreviewAllSheets(sheets);

      const activeSem = student.semester || 1;
      const romanNumerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      const activeRoman = romanNumerals[activeSem] || "";

      let initialSheet = sheets.find((s) => {
        const label = (s.semester_label || "").toUpperCase();
        const numPattern = new RegExp(`\\b${activeSem}\\b`);
        const romanPattern = activeRoman ? new RegExp(`\\b${activeRoman}\\b`) : null;
        return numPattern.test(label) || (romanPattern && romanPattern.test(label));
      });

      if (!initialSheet && sheets.length > 0) {
        initialSheet = sheets[0];
      }

      setPreviewMarksheet(initialSheet || null);
      if (initialSheet) {
        const photoUrl = await resolveStudentPhotoUrl(supabase, initialSheet, {
          studentUuid: student.id,
        });
        setPreviewPhotoUrl(photoUrl);
      }
    } catch (e) {
      toast.error("Could not load grade card preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSelectPreviewSemester(sheet: StudentMarksheet) {
    setPreviewMarksheet(sheet);
    setShowAllSemesters(false);
    try {
      const photoUrl = await resolveStudentPhotoUrl(supabase, sheet, {
        studentUuid: previewStudent?.id,
      });
      setPreviewPhotoUrl(photoUrl);
    } catch (e) {
      console.error(e);
    }
  }

  async function load() {
    setLoading(true);
    const [
      { data: studentRows, error: studentError },
      { data: marksheetRows, error: marksheetError },
      { data: markRows, error: markErr },
      { data: notificationRows, error: notificationErr },
      { data: gradeCardRequestRows, error: gradeCardRequestErr },
    ] = await Promise.all([
      supabase.from("students").select("*").order("student_id", { ascending: true }),
      supabase.from("student_marksheets").select("*").order("updated_at", { ascending: false }),
      supabase.from("student_marks").select("student_id,subject_code,subject"),
      supabase
        .from("portal_notifications")
        .select("student_id")
        .eq("recipient_portal", "head_of_coe")
        .eq("is_resolved", false),
      supabase
        .from("portal_notifications")
        .select("id, title, message, is_read, created_at, student_id")
        .eq("recipient_portal", "admin")
        .eq("title", GRADE_CARD_REQUEST_NOTIFICATION_TITLE)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (studentError) toast.error(studentError.message);
    if (marksheetError) toast.error(marksheetError.message);
    if (markErr) toast.error(markErr.message);
    if (notificationErr) toast.error(notificationErr.message);
    if (gradeCardRequestErr) toast.error(gradeCardRequestErr.message);

    setStudents((studentRows as Student[]) ?? []);
    setMarksheets(
      ((marksheetRows as Record<string, unknown>[] | null) ?? []).map((row) =>
        normalizeMarksheet(row),
      ),
    );
    setStudentMarks((markRows as any[]) ?? []);

    setUnresolvedReports(
      new Set(
        ((notificationRows ?? []) as { student_id: string | null }[])
          .map((r) => r.student_id)
          .filter(Boolean) as string[],
      ),
    );

    setGradeCardRequestNotifications((gradeCardRequestRows as GradeCardRequestNotification[]) ?? []);

    setLoading(false);
  }

  async function dismissGradeCardRequestNotifications() {
    const unreadIds = gradeCardRequestNotifications.filter((row) => !row.is_read).map((row) => row.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from("portal_notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  const unreadGradeCardRequests = useMemo(
    () => gradeCardRequestNotifications.filter((row) => !row.is_read),
    [gradeCardRequestNotifications],
  );

  useEffect(() => {
    void load();
    return subscribePostgresChanges(
      "faculty:students-and-marksheets",
      [
        { event: "*", schema: "public", table: "students" },
        { event: "*", schema: "public", table: "student_marksheets" },
        { event: "*", schema: "public", table: "portal_notifications" },
      ],
      () => {
        void load();
      },
    );
  }, []);

  const marksheetByStudentId = useMemo(
    () => new Map(marksheets.map((marksheet) => [marksheet.student_id, marksheet])),
    [marksheets],
  );

  const courseCountByStudentId = useMemo(() => {
    const studentCodes = new Map<string, Set<string>>();

    const getSet = (sid: string) => {
      let s = studentCodes.get(sid);
      if (!s) {
        s = new Set<string>();
        studentCodes.set(sid, s);
      }
      return s;
    };

    for (const ms of marksheets) {
      const s = getSet(ms.student_id);
      const coursesArr = Array.isArray(ms.courses) ? ms.courses : [];
      for (const c of coursesArr) {
        const code = c.course_code || c.course_title;
        if (code) s.add(code);
      }
    }

    for (const row of studentMarks) {
      const s = getSet(row.student_id);
      const code = row.subject_code || row.subject;
      if (code) s.add(code);
    }

    const countMap = new Map<string, number>();
    for (const [sid, set] of studentCodes.entries()) {
      countMap.set(sid, set.size);
    }
    return countMap;
  }, [marksheets, studentMarks]);

  const rows = useMemo(() => {
    const uniqueMarksMap = new Map<string, number>();
    const studentCodes = new Map<string, Set<string>>();
    for (const row of studentMarks) {
      let s = studentCodes.get(row.student_id);
      if (!s) {
        s = new Set<string>();
        studentCodes.set(row.student_id, s);
      }
      const code = row.subject_code || row.subject;
      if (code) s.add(code);
    }
    for (const [sid, s] of studentCodes.entries()) {
      uniqueMarksMap.set(sid, s.size);
    }

    return students
      .filter((student) => Boolean(student.marksheet_verification_requested_at))
      .map((student) => ({
        student,
        marksheet: marksheetByStudentId.get(student.id) ?? null,
        legacyCourseCount: uniqueMarksMap.get(student.id) ?? 0,
      }));
  }, [students, marksheetByStudentId, studentMarks]);

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

    if (verifiedFilter === "pending") {
      list = list.filter(({ student }) => !student.faculty_verified);
    } else if (verifiedFilter === "done") {
      list = list.filter(({ student }) => student.faculty_verified);
    }

    return [...list].sort((a, b) => {
      if (sortKey === "request") {
        const aTime = a.student.marksheet_verification_requested_at
          ? new Date(a.student.marksheet_verification_requested_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.student.marksheet_verification_requested_at
          ? new Date(b.student.marksheet_verification_requested_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }
      if (sortKey === "name") {
        return a.student.full_name.localeCompare(b.student.full_name);
      }
      if (sortKey === "dept") {
        return (
          a.student.department.localeCompare(b.student.department) ||
          a.student.student_id.localeCompare(b.student.student_id)
        );
      }
      return a.student.student_id.localeCompare(b.student.student_id);
    });
  }, [rows, searchQuery, sortKey, verifiedFilter]);

  async function toggleFacultyVerified(
    student: Student,
    marksheet: StudentMarksheet | null,
    legacyCourseCount: number,
  ) {
    const hasMarksData = Boolean(marksheet) || legacyCourseCount > 0;
    if (!hasMarksData && !student.faculty_verified) {
      toast.error("No marks are saved for this student yet.");
      return;
    }

    const next = !student.faculty_verified;
    if (next && !student.marksheet_verification_requested_at) {
      toast.error("This student has not requested grade card verification from their portal yet.");
      return;
    }
    setBusyStudentId(student.id);
    try {
      const { error } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(next))
        .eq("id", student.id);
      if (error) throw error;

      toast.success(next ? "Admin verification complete" : "Admin verification removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin verification update failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function reportIssue(student: Student) {
    setBusyStudentId(student.id);
    try {
      const title = "Grade Card correction requested";
      if (
        await hasRecentDuplicateSuperAdminReport(supabase, {
          studentId: student.id,
          title,
          senderPortal: "admin",
        })
      ) {
        toast.message("Already sent", {
          description:
            "An open correction for this student was sent recently. Wait before sending again.",
        });
        return;
      }

      const { error: notificationError } = await supabase.from("portal_notifications").insert({
        recipient_portal: "head_of_coe",
        sender_portal: "admin",
        student_id: student.id,
        title: "Admin requested a correction",
        message: `Please recheck and edit grade card data for ${student.student_id} (${student.full_name}).`,
      });
      if (notificationError) throw notificationError;

      const { error: studentError } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(false))
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Correction sent to COE");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Correction failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function confirmIssueGradeCard() {
    if (!issueModal) return;
    const { student, marksheet, legacyCourseCount } = issueModal;
    const hasMarksheetData = Boolean(marksheet) || legacyCourseCount > 0;

    setBusyStudentId(student.id);
    try {
      const payload = {
        ...buildAdminVerificationUpdate({
          student,
          next: true,
          hasMarksheet: hasMarksheetData,
        }),
        grade_card_issue_date: marksheet?.issue_date || student.grade_card_issue_date || new Date().toISOString().split("T")[0],
      };
      const { error } = await supabase.from("students").update(payload).eq("id", student.id);
      if (error) throw error;

      await syncStudentGradeAndMarksheet(supabase, student.id);

      toast.success("Grade card issued for student.");
      setIssueModal(null);
      setPreviewConfirmedIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Issue failed");
    } finally {
      setBusyStudentId(null);
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <h2 className="text-xl font-bold text-primary">Admin Queue</h2>

      {unreadGradeCardRequests.length > 0 && (
        <section className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Bell className="h-4 w-4" aria-hidden />
                {unreadGradeCardRequests.length} new grade card request
                {unreadGradeCardRequests.length === 1 ? "" : "s"}
              </p>
              <ul className="space-y-1 text-sm text-primary/90">
                {unreadGradeCardRequests.slice(0, 5).map((row) => (
                  <li key={row.id}>{row.message}</li>
                ))}
              </ul>
              {unreadGradeCardRequests.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{unreadGradeCardRequests.length - 5} more in the notification bell
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void dismissGradeCardRequestNotifications()}
              className="shrink-0 rounded-md border border-primary/30 bg-cream px-3 py-1.5 text-xs font-medium text-primary hover:bg-secondary"
            >
              Mark all read
            </button>
          </div>
        </section>
      )}

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
            onChange={(e) => setSortKey(e.target.value as "request" | "roll" | "name" | "dept")}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="request">Request date (first come)</option>
            <option value="roll">Roll number</option>
            <option value="name">Name</option>
            <option value="dept">Department</option>
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-muted-foreground">
          Verification status
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="all">All students</option>
            <option value="pending">Pending verification</option>
            <option value="done">Verified</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground lg:pb-2">
          Showing {filteredRows.length} of {rows.length} students
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading students and marks…</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Requested</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Grade Card</th>
                <th className="px-2 py-2 text-center">Courses</th>
                <th className="px-2 py-2 text-center">Grade</th>
                <th className="px-2 py-2 text-center">Admin</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, marksheet, legacyCourseCount }, rowIndex) => {
                const courseCount = courseCountByStudentId.get(student.id) || 0;
                const hasMarks = Boolean(marksheet) || legacyCourseCount > 0;
                const isIssued = Boolean(student.admin_verified);
                const previewConfirmed = previewConfirmedIds.has(student.id);
                const isFirstInQueue = sortKey === "request" && rowIndex === 0 && !isIssued;
                const issueDisabled =
                  busyStudentId === student.id ||
                  unresolvedReports.has(student.id) ||
                  isIssued ||
                  !previewConfirmed;
                const correctionDisabled =
                  busyStudentId === student.id || isIssued || unresolvedReports.has(student.id);

                return (
                  <tr
                    key={student.id}
                    className={`border-b border-border/60 transition-colors ${
                      isFirstInQueue
                        ? "bg-amber-50/90 ring-1 ring-inset ring-amber-300"
                        : isIssued
                          ? "bg-emerald-50/40"
                          : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="px-2 py-3">
                      <div>
                        <p className="font-medium text-primary">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{student.student_id}</p>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <p className="flex items-center gap-1.5 text-xs text-primary">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {formatRequestDate(student.marksheet_verification_requested_at)}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      {isIssued ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {marksheet ? (
                        <div>
                          <p className="font-medium text-primary">
                            {marksheet.programme_code}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {marksheet.programme_title}
                          </p>
                        </div>
                      ) : legacyCourseCount > 0 ? (
                        <div>
                          <p className="font-medium text-primary">Subject marks on file</p>
                          <p className="text-xs text-muted-foreground">
                            {legacyCourseCount} courses
                          </p>
                        </div>
                      ) : (
                        <span className="font-medium text-amber-700">Missing</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center text-primary">{courseCount}</td>
                    <td className="px-2 py-3 text-center">{marksheet?.final_grade ?? "-"}</td>
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(student.faculty_verified)}
                        disabled={
                          busyStudentId === student.id ||
                          unresolvedReports.has(student.id) ||
                          (!hasMarks && !student.faculty_verified) ||
                          (!student.marksheet_verification_requested_at &&
                            !student.faculty_verified)
                        }
                        onChange={() =>
                          void toggleFacultyVerified(student, marksheet, legacyCourseCount)
                        }
                        title={unresolvedReports.has(student.id) ? "Waiting for COE to resolve report" : ""}
                        aria-label={`Admin for ${student.student_id}`}
                      />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex flex-nowrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview(student)}
                          disabled={busyStudentId === student.id}
                          className="inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-md bg-emerald-600 px-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-60"
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueModal({ student, marksheet, legacyCourseCount })}
                          disabled={issueDisabled}
                          title={
                            isIssued
                              ? "Grade card already issued"
                              : !previewConfirmed
                                ? "Open preview and confirm before issuing"
                                : unresolvedReports.has(student.id)
                                  ? "Waiting for COE to resolve correction"
                                  : "Issue grade card"
                          }
                          className={`inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                            isIssued
                              ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                              : "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
                          }`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{isIssued ? "Issued" : "Issue"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void reportIssue(student)}
                          disabled={correctionDisabled}
                          title={
                            isIssued
                              ? "Correction unavailable after grade card is issued"
                              : unresolvedReports.has(student.id)
                                ? "Correction already sent — waiting for COE"
                                : "Send correction to COE"
                          }
                          className="inline-flex h-7 w-[5.5rem] shrink-0 items-center justify-center gap-1 rounded-md border border-red-600 bg-red-600 px-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Correction</span>
                        </button>
                        <Link
                          to={`/admin/students/${student.id}`}
                          className="inline-flex h-7 w-[4.25rem] shrink-0 items-center justify-center gap-1 rounded-md bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">View</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {students.length > 0 && rows.length === 0
                ? "No students have requested grade card verification yet. They submit the request from their portal after clearing fees."
                : "No students match your search or filters."}
            </p>
          )}
        </div>
      )}

      {/* Issue Grade Card Modal */}
      {issueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Issue Certificate</h3>
              <button
                onClick={() => setIssueModal(null)}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Please confirm that you want to issue the Grade Card for {issueModal.student.full_name} ({issueModal.student.student_id}).
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIssueModal(null)}
                className="rounded-md border border-border bg-cream px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmIssueGradeCard()}
                disabled={busyStudentId === issueModal.student.id}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" /> Confirm & Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Card Preview Dialog */}
      <Dialog open={Boolean(previewStudent)} onOpenChange={(open) => { if (!open) setPreviewStudent(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Grade Card Preview: {previewStudent?.full_name} ({previewStudent?.student_id})
            </DialogTitle>
          </DialogHeader>

          {previewStudent && (
            <>
              <GradeCardPreviewViewer
                studentId={previewStudent.id}
                activeSheet={previewMarksheet}
                allSheets={previewAllSheets}
                photoUrl={previewPhotoUrl}
                showAllSemesters={showAllSemesters}
                loading={previewLoading}
                darkTheme
                showDownloadButton={false}
                onSelectSemester={(sheet) => void handleSelectPreviewSemester(sheet)}
                onShowAllSemesters={() => setShowAllSemesters(true)}
                emptyMessage="No marksheet data found for this student."
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-300">
                  {previewConfirmedIds.has(previewStudent.id)
                    ? "Preview confirmed — you may issue the grade card from the queue."
                    : "Review the grade card, then confirm to unlock Issue grade card."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleConfirmPreview()}
                  disabled={previewLoading || previewConfirmedIds.has(previewStudent.id)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {previewConfirmedIds.has(previewStudent.id) ? "Confirmed" : "Confirm preview"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
