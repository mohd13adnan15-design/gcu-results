import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, MessageSquareWarning, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { StudentMarksheet } from "@/lib/marksheet";
import {
  normalizeMarksheet,
  fetchStudentMarksheet,
  fetchAllStudentMarksheets,
  resolveStudentPhotoUrl,
  calculateMarksheetTotals,
} from "@/lib/marksheet";
import { HighFidelityGradeCard } from "@/features/marks/HighFidelityGradeCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildAdminVerificationUpdate,
  buildFacultyVerificationUpdate,
} from "@/lib/marksheet-verification";
import { syncStudentGradeAndMarksheet } from "@/lib/marks-sync";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import type { Student } from "@/lib/types";

export function FacultyPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marksheets, setMarksheets] = useState<StudentMarksheet[]>([]);
  const [studentMarks, setStudentMarks] = useState<{ student_id: string; subject_code: string | null; subject: string | null }[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"roll" | "name" | "dept">("roll");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "pending" | "done">("all");
  const [unresolvedReports, setUnresolvedReports] = useState<Set<string>>(new Set());
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
        const photoUrl = await resolveStudentPhotoUrl(supabase, initialSheet);
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
      const photoUrl = await resolveStudentPhotoUrl(supabase, sheet);
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
    ] = await Promise.all([
      supabase.from("students").select("*").order("student_id", { ascending: true }),
      supabase.from("student_marksheets").select("*").order("updated_at", { ascending: false }),
      supabase.from("student_marks").select("student_id,subject_code,subject"),
      supabase
        .from("portal_notifications")
        .select("student_id")
        .eq("recipient_portal", "head_of_coe")
        .eq("is_resolved", false),
    ]);

    if (studentError) toast.error(studentError.message);
    if (marksheetError) toast.error(marksheetError.message);
    if (markErr) toast.error(markErr.message);
    if (notificationErr) toast.error(notificationErr.message);

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

    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("faculty:students-and-marksheets")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_marksheets" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "portal_notifications" }, () => {
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
      const title = "Grade Card issue reported";
      if (
        await hasRecentDuplicateSuperAdminReport(supabase, {
          studentId: student.id,
          title,
          senderPortal: "admin_2",
        })
      ) {
        toast.message("Already reported", {
          description:
            "An open report for this student was sent recently. Wait before reporting again.",
        });
        return;
      }

      const { error: notificationError } = await supabase.from("portal_notifications").insert({
        recipient_portal: "head_of_coe",
        sender_portal: "admin_2",
        student_id: student.id,
        title: "Admin reported a mismatch",
        message: `Please recheck and edit grade card data for ${student.student_id} (${student.full_name}).`,
      });
      if (notificationError) throw notificationError;

      const { error: studentError } = await supabase
        .from("students")
        .update(buildFacultyVerificationUpdate(false))
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Issue reported");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report failed");
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
                <th className="px-2 py-2">Grade Card</th>
                <th className="px-2 py-2 text-center">Courses</th>
                <th className="px-2 py-2 text-center">Grade</th>
                <th className="px-2 py-2 text-center">Admin</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ student, marksheet, legacyCourseCount }) => {
                const courseCount = courseCountByStudentId.get(student.id) || 0;
                const hasMarks = Boolean(marksheet) || legacyCourseCount > 0;
                return (
                  <tr key={student.id} className="border-b border-border/60">
                    <td className="px-2 py-3">
                      <p className="font-medium text-primary">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.student_id}</p>
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
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview(student)}
                          disabled={busyStudentId === student.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 transition-colors px-2 py-1 text-xs font-semibold text-white disabled:opacity-60 shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueModal({ student, marksheet, legacyCourseCount })}
                          disabled={busyStudentId === student.id || unresolvedReports.has(student.id)}
                          title={unresolvedReports.has(student.id) ? "Waiting for COE to resolve report" : ""}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Issue grade card
                        </button>
                        <button
                          type="button"
                          onClick={() => void reportIssue(student)}
                          disabled={busyStudentId === student.id}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary disabled:opacity-60"
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5" /> Report
                        </button>
                        <Link
                          to={`/admin/students/${student.id}`}
                          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
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
          <div className="mt-4 flex flex-col items-center">
            {!previewLoading && previewAllSheets.length > 1 && (
              <div className="mb-6 flex flex-wrap justify-center items-center gap-2.5 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 w-full max-w-xl">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mr-2">
                  Select Semester:
                </span>
                {previewAllSheets.map((sheet) => {
                  const semName = (sheet.semester_label || "").toLowerCase().startsWith("sem")
                    ? sheet.semester_label
                    : `Sem ${sheet.semester_label}`;
                  const isSelected = !showAllSemesters && previewMarksheet?.semester_label === sheet.semester_label;
                  return (
                    <button
                      key={sheet.semester_label}
                      type="button"
                      onClick={() => void handleSelectPreviewSemester(sheet)}
                      className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-extrabold transition duration-200 border shadow-sm ${isSelected
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 scale-105"
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                        }`}
                    >
                      {semName}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowAllSemesters(true)}
                  className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-extrabold transition duration-200 border shadow-sm ${showAllSemesters
                      ? "bg-amber-600 border-amber-500 text-white shadow-amber-900/50 scale-105"
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                >
                  All Sem
                </button>
              </div>
            )}

            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-slate-400">Loading grade card preview...</p>
              </div>
            ) : previewMarksheet ? (
              <div className="w-full overflow-x-auto flex justify-center bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                {showAllSemesters ? (
                  <div className="flex flex-col gap-10 w-full items-center my-4">
                    {[...previewAllSheets]
                      .sort((a, b) => getSemesterNumber(a.semester_label) - getSemesterNumber(b.semester_label))
                      .map((sheet) => {
                        const filteredSheet = getFilteredMarksheet(sheet, previewAllSheets, false)!;
                        return (
                          <div key={sheet.id || sheet.semester_label} className="flex flex-col items-center w-full">
                            <div className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700/50">
                              Semester {sheet.semester_label}
                            </div>
                            <div className="origin-top scale-[0.85] md:scale-100 shadow-2xl border border-slate-800 rounded-xl overflow-hidden">
                              <HighFidelityGradeCard
                                marksheet={filteredSheet}
                                photoUrl={previewPhotoUrl}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="origin-top scale-[0.85] md:scale-100 my-4">
                    <HighFidelityGradeCard
                      marksheet={getFilteredMarksheet(previewMarksheet, previewAllSheets, false)!}
                      photoUrl={previewPhotoUrl}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400">
                No marksheet data found for this student.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
