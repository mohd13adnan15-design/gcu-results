import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, MessageSquareWarning, Download } from "lucide-react";
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
import {
  GradeCardESignaturePanel,
  useGradeCardSignatureApproved,
} from "@/features/marks/GradeCardESignaturePanel";
import { fetchApprovedBackPageSignatures } from "@/lib/grade-card-e-signature";
import { downloadMarksheetBlob, generateMarksheetPdf } from "@/lib/marksheet-documents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildAdminVerificationUpdate,
  calculateFeeStatus,
  canAdminVerifyMarksheet,
  getMarksheetEligibility,
  missingReasonLabel,
} from "@/lib/marksheet-verification";
import { hasRecentDuplicateSuperAdminReport } from "@/lib/portal-report-dedupe";
import type { Student } from "@/lib/types";

export function AdminPage() {
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

  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewMarksheet, setPreviewMarksheet] = useState<StudentMarksheet | null>(null);
  const [previewAllSheets, setPreviewAllSheets] = useState<StudentMarksheet[]>([]);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAllSemesters, setShowAllSemesters] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { approved: signaturesApproved, refresh: refreshSignatures } = useGradeCardSignatureApproved(
    previewStudent?.id ?? "",
  );

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

  async function handleGenerateFinalPdf() {
    if (!previewStudent || !previewMarksheet) return;
    if (!signaturesApproved) {
      toast.error("Approve e-signatures before generating the final grade card PDF.");
      return;
    }
    setPdfBusy(true);
    try {
      const sheet = getFilteredMarksheet(previewMarksheet, previewAllSheets, showAllSemesters);
      if (!sheet) return;
      const [photoUrl, backSigs] = await Promise.all([
        resolveStudentPhotoUrl(supabase, previewMarksheet, { studentUuid: previewStudent.id }),
        fetchApprovedBackPageSignatures(supabase, previewStudent.id),
      ]);
      const blob = await generateMarksheetPdf(sheet, {
        photoUrl,
        allMarksheets: previewAllSheets,
        backPageSignatures: {
          checkedByUrl: backSigs.checkedByUrl,
          verifiedByUrl: backSigs.verifiedByUrl,
        },
      });
      downloadMarksheetBlob(sheet, "pdf", blob);
      toast.success("Final grade card PDF downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

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
      students
        .filter((student) => Boolean(student.marksheet_verification_requested_at))
        .map((student) => {
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
          return {
            student,
            marksheet,
            eligibility,
            adminReady,
            legacyCourseCount: legacyMarkCount.get(student.id) ?? 0,
          };
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
        return (
          a.student.department.localeCompare(b.student.department) ||
          a.student.student_id.localeCompare(b.student.student_id)
        );
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

    if (next && !canAdminVerifyMarksheet(student, true)) {
      toast.error(
        "Admin verification is only available after the student requests verification and COE approves.",
      );
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
      toast.error(error instanceof Error ? error.message : "Admin verification update failed");
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
          senderPortal: "admin_2",
        })
      ) {
        toast.message("Already reported", {
          description:
            "An open report for this student was sent recently. Wait or contact Head of COE instead of reporting again.",
        });
        return;
      }

      const { error: notificationError } = await supabase.from("portal_notifications").insert({
        recipient_portal: "head_of_coe",
        sender_portal: "admin_2",
        student_id: student.id,
        title,
        message: `Please recheck fees, hostel, library, and grade card data for ${student.student_id}.`,
      });
      if (notificationError) throw notificationError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ admin_verified: false, fully_verified: false })
        .eq("id", student.id);
      if (studentError) throw studentError;

      toast.success("Issue reported to Head of COE");
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
            onChange={(e) => setVerificationFilter(e.target.value as typeof verificationFilter)}
            className="rounded-md border border-border bg-cream px-3 py-2 text-sm text-primary"
          >
            <option value="all">All students</option>
            <option value="pending_faculty">Pending COE</option>
            <option value="pending_admin">Pending Verification</option>
            <option value="admin_done">Admin done</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground lg:pb-2">
          Showing {filteredRows.length} of {rows.length} students
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Loading students and grade cards…</p>
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
                <th className="px-2 py-2">Grade Card</th>
                <th className="px-2 py-2">COE</th>
                <th className="px-2 py-2">Admin</th>
                <th className="px-2 py-2">Result</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(
                ({ student, marksheet, eligibility, adminReady, legacyCourseCount }) => (
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
                    onPreview={() => void handleOpenPreview(student)}
                  />
                ),
              )}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <h2 className="text-xl font-bold text-primary">Admin Queue</h2>
          )}
        </div>
            <Dialog open={Boolean(previewStudent)} onOpenChange={(open) => { if (!open) setPreviewStudent(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Grade Card Preview: {previewStudent?.full_name} ({previewStudent?.student_id})
            </DialogTitle>
          </DialogHeader>

          {previewStudent && (
            <div className="space-y-4">
              <GradeCardESignaturePanel
                studentId={previewStudent.id}
                darkTheme
                onApprovalChange={() => void refreshSignatures()}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!previewMarksheet || pdfBusy || !signaturesApproved}
                  onClick={() => void handleGenerateFinalPdf()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generate Final PDF
                </button>
              </div>
            </div>
          )}

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
                      className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-extrabold transition duration-200 border shadow-sm ${
                        isSelected
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
                  className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-extrabold transition duration-200 border shadow-sm ${
                    showAllSemesters
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 scale-105"
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

function AdminStudentRow({
  student,
  marksheet,
  legacyCourseCount,
  eligibility,
  adminReady,
  busy,
  onVerify,
  onReport,
  onPreview,
}: {
  student: Student;
  marksheet: StudentMarksheet | null;
  legacyCourseCount: number;
  eligibility: ReturnType<typeof getMarksheetEligibility>;
  adminReady: boolean;
  busy: boolean;
  onVerify: (next: boolean) => void;
  onReport: () => void;
  onPreview: () => void;
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
            !student.in_library ? "Clear" : student.library_cleared ? "Clear" : "Pending"
          }
        />
      </td>
      <td className="px-2 py-3">
        {marksheet ? (
          <div>
            <h2 className="text-base font-semibold text-primary capitalize">
              Update marks from Excel
            </h2>
            <p className="text-xs text-muted-foreground">
              {marksheet.courses.length} courses · SGPA {marksheet.sgpa.toFixed(2)} ·{" "}
              {marksheet.final_grade}
            </p>
          </div>
        ) : legacyCourseCount > 0 ? (
          <div>
            <p className="font-medium text-primary">Subject marks · {legacyCourseCount} courses</p>
            <p className="text-xs text-muted-foreground">Saved via bulk upload / Head of COE</p>
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
          disabled={
            busy ||
            (!student.admin_verified &&
              (!adminReady ||
                !student.marksheet_verification_requested_at ||
                !student.faculty_verified))
          }
          onChange={(event) => onVerify(event.target.checked)}
          aria-label={`Admin for ${student.student_id}`}
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
            onClick={onPreview}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 transition-colors px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 shadow-sm"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            type="button"
            onClick={onReport}
            disabled={busy}
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
}

function StatusText({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "font-medium text-primary" : "font-medium text-amber-700"}>{label}</span>
  );
}
