import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildMainGradeCardRows } from "@/lib/main-grade-card";
import { syncStudentGradeAndMarksheet } from "@/lib/marks-sync";
import { gradePointsFromGradeLetter } from "@/lib/marks-excel-template";
import { fetchStudentMarksheet, marksheetCoursesToStudentMarkInserts } from "@/lib/marksheet";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { RefreshCw, Plus, Save, Trash2 } from "lucide-react";

/** Matches marksheet preview boxes — clearly interactive on Super Admin. */
const PRETTY_PROGRAMME =
  "rounded-lg border border-border bg-white px-3 py-2 text-lg font-bold text-primary shadow-sm outline-none transition hover:border-primary/45 focus:border-primary focus:ring-2 focus:ring-primary/20";
const PRETTY_FIELD =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20";
const PRETTY_ROLL_READONLY =
  "mt-1 w-full cursor-not-allowed rounded-lg border border-dashed border-muted-foreground/45 bg-muted/35 px-3 py-2 text-sm text-muted-foreground";
const PRETTY_TABLE_INPUT =
  "min-w-0 rounded-md border border-border bg-white px-1.5 py-1.5 text-xs text-primary shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/25";

type DraftMark = StudentMarkRow & { id?: string };

type HeaderFormState = {
  programme_title: string;
  programme_code: string;
  card_student_name: string;
  registration_no: string;
  exam_month_year: string;
  issue_date: string;
  semester_label: string;
  semester_gpa: number;
  final_grade: string;
  university: string;
  school_name: string;
  grade_card_no: string;
  qr_data: string;
};

type GradeCardHeaderRow = {
  programme_title?: string | null;
  programme_code?: string | null;
  student_name?: string | null;
  registration_no?: string | null;
  exam_month_year?: string | null;
  issue_date?: string | null;
  semester_label?: string | null;
  semester_gpa?: number | string | null;
  final_grade?: string | null;
};

type Props = {
  studentId: string;
  /** Fires after a successful sync to `student_marksheets` (e.g. refresh Super Admin preview). */
  onMarksheetSynced?: () => void;
  /** Fewer headings/tooltips — used on Super Admin student hub. */
  compact?: boolean;
  /** Marks card layout like faculty View — same fields, all inputs + save (Super Admin). */
  prettyCard?: boolean;
};

export function StudentMarksAdminEditor({
  studentId,
  onMarksheetSynced,
  compact = false,
  prettyCard = false,
}: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [header, setHeader] = useState<HeaderFormState | null>(null);
  const [marks, setMarks] = useState<DraftMark[]>([]);
  const [draft, setDraft] = useState<DraftMark>({
    subject: "",
    subject_code: "",
    course_category: "CORE COURSE",
    credits: 4,
    credits_earned: 4,
    marks_obtained: 0,
    max_marks: 100,
    grade: "",
    grade_points: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [headerBusy, setHeaderBusy] = useState(false);

  async function syncMainGradeCardForStudent(
    s: Student,
    h: HeaderFormState | null,
    nextMarks: DraftMark[],
  ) {
    const rowHeader = h ?? {
      programme_title: "Bachelor of Computer Applications",
      programme_code: "BCAR",
      card_student_name: s.full_name,
      registration_no: s.student_id,
      exam_month_year: "",
      issue_date: "",
      semester_label: `Semester ${s.semester}`,
      semester_gpa: 0,
      final_grade: "",
      university: "Garden City University",
      school_name: "SCHOOL OF ENGINEERING AND TECHNOLOGY",
      grade_card_no: "",
      qr_data: "",
    };
    const rows = buildMainGradeCardRows(
      s,
      {
        ...rowHeader,
        student_name: h?.card_student_name?.trim() || s.full_name,
      },
      nextMarks,
    );
    const { error: deleteError } = await supabase
      .from("main_grade_card")
      .delete()
      .eq("student_id", s.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from("main_grade_card").insert(rows);
    if (insertError) throw insertError;
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: studentData },
      { data: headerData },
      { data: marksData },
      { data: msheet },
    ] = await Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase
        .from("grade_card_details")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_marks")
        .select(
          "id,subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points",
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("student_marksheets")
        .select("university,school_name,grade_card_no,qr_data")
        .eq("student_id", studentId)
        .maybeSingle(),
    ]);

    const currentStudent = (studentData as Student | null) ?? null;
    const headerRow = (headerData as GradeCardHeaderRow | null) ?? null;
    const sheetExtra = (msheet as {
      university?: string | null;
      school_name?: string | null;
      grade_card_no?: string | null;
      qr_data?: string | null;
    } | null) ?? null;
    setStudent(currentStudent);
    const nextHeader: HeaderFormState = {
      programme_title: headerRow?.programme_title ?? "Bachelor of Computer Applications",
      programme_code: headerRow?.programme_code ?? "BCAR",
      card_student_name:
        headerRow?.student_name?.trim() || currentStudent?.full_name || "",
      registration_no: headerRow?.registration_no ?? currentStudent?.student_id ?? "",
      exam_month_year: headerRow?.exam_month_year ?? "",
      issue_date: headerRow?.issue_date ?? "",
      semester_label: headerRow?.semester_label ?? `Semester ${currentStudent?.semester ?? ""}`,
      semester_gpa: Number(headerRow?.semester_gpa ?? 0),
      final_grade: headerRow?.final_grade ?? "",
      university: sheetExtra?.university ?? "Garden City University",
      school_name:
        sheetExtra?.school_name ?? "SCHOOL OF ENGINEERING AND TECHNOLOGY",
      grade_card_no: sheetExtra?.grade_card_no ?? "",
      qr_data:
        sheetExtra?.qr_data ??
        (currentStudent
          ? `GCU|${currentStudent.student_id}|${currentStudent.student_id}|${currentStudent.full_name}`
          : ""),
    };
    setHeader(nextHeader);

    let nextMarks = ((marksData as DraftMark[]) ?? []).filter(Boolean);

    if (nextMarks.length === 0 && currentStudent) {
      try {
        const sheet = await fetchStudentMarksheet(supabase, studentId);
        if (sheet?.courses?.length) {
          const inserts = marksheetCoursesToStudentMarkInserts(studentId, sheet.courses);
          const { data: inserted, error: insErr } = await supabase
            .from("student_marks")
            .insert(inserts)
            .select(
              "id,subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points",
            );
          if (insErr) throw insErr;
          if (inserted?.length) {
            nextMarks = inserted as DraftMark[];
            toast.success(
              `Loaded ${inserted.length} courses from marksheet JSON into editable rows (student_marks).`,
            );
            await syncMainGradeCardForStudent(currentStudent, nextHeader, nextMarks);
            await syncStudentGradeAndMarksheet(supabase, studentId);
            onMarksheetSynced?.();
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not import courses from marksheet JSON");
      }
    }

    setMarks(nextMarks);
    setLoading(false);
  }, [studentId, onMarksheetSynced]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSync() {
    if (!student || !header) return;
    try {
      await syncStudentGradeAndMarksheet(supabase, student.id, {
        university: header.university,
        school_name: header.school_name,
        grade_card_no: header.grade_card_no,
        qr_data: header.qr_data,
        programme_title: header.programme_title,
        programme_code: header.programme_code,
        student_name: header.card_student_name.trim() || student.full_name,
        registration_no: header.registration_no,
        semester_label: header.semester_label,
        exam_month_year: header.exam_month_year,
        issue_date: header.issue_date,
      });
      onMarksheetSynced?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync marksheet");
    }
  }

  async function saveGradeCardHeader() {
    if (!student || !header) return;
    setHeaderBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("grade_card_details").upsert(
        {
          student_id: student.id,
          student_name: header.card_student_name.trim() || student.full_name,
          programme_title: header.programme_title,
          programme_code: header.programme_code,
          registration_no: header.registration_no,
          semester_label: header.semester_label,
          exam_month_year: header.exam_month_year,
          issue_date: header.issue_date,
          updated_at: now,
          created_at: now,
        },
        { onConflict: "student_id" },
      );
      if (error) throw error;
      await runSync();
      toast.success("Header saved; SGPA and student marksheet record updated from subject rows.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setHeaderBusy(false);
    }
  }

  async function syncMainGradeCard(nextMarks: DraftMark[]) {
    if (!student) return;
    await syncMainGradeCardForStudent(student, header, nextMarks);
  }

  async function saveRow(row: DraftMark) {
    if (!row.id) return;
    const marksObtained = Number(row.marks_obtained ?? 0);
    const maxMarks = Number(row.max_marks ?? 100);
    const grade = String(row.grade ?? "")
      .trim()
      .toUpperCase();
    const credits = Number(row.credits ?? 0);
    const creditsEarned = Number(row.credits_earned ?? 0) || (grade === "RA" ? 0 : credits);
    const gradePoints =
      Number(row.grade_points ?? 0) || gradePointsFromGradeLetter(grade || "RA");
    setSavingId(row.id);
    try {
      const { error } = await supabase
        .from("student_marks")
        .update({
          subject: row.subject,
          subject_code: row.subject_code,
          course_category: row.course_category,
          credits,
          credits_earned: creditsEarned,
          marks_obtained: marksObtained,
          max_marks: maxMarks,
          grade,
          grade_points: gradePoints,
        })
        .eq("id", row.id);
      if (error) throw error;
      const nextMarks = marks.map((item) => (item.id === row.id ? { ...item, ...row } : item));
      setMarks(nextMarks);
      await syncMainGradeCard(nextMarks);
      await runSync();
      await load();
      toast.success("Mark updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update mark");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this mark row?")) return;
    try {
      const { error } = await supabase.from("student_marks").delete().eq("id", id);
      if (error) throw error;
      const nextMarks = marks.filter((item) => item.id !== id);
      setMarks(nextMarks);
      await syncMainGradeCard(nextMarks);
      await runSync();
      await load();
      toast.success("Mark deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function addManual() {
    if (!student || !draft.subject || !draft.subject_code) {
      toast.error("Enter subject code and subject title first.");
      return;
    }
    try {
      const grade = String(draft.grade ?? "")
        .trim()
        .toUpperCase();
      const credits = Number(draft.credits ?? 0);
      const creditsEarned = Number(draft.credits_earned ?? 0) || (grade === "RA" ? 0 : credits);
      const g = grade || "RA";
      const gradePoints = Number(draft.grade_points ?? 0) || gradePointsFromGradeLetter(g);
      const payload = {
        student_id: student.id,
        subject: draft.subject,
        subject_code: draft.subject_code,
        course_category: draft.course_category ?? "CORE COURSE",
        credits,
        credits_earned: creditsEarned,
        marks_obtained: Number(draft.marks_obtained ?? 0),
        max_marks: Number(draft.max_marks ?? 100),
        grade: g,
        grade_points: gradePoints,
      };
      const { data, error } = await supabase
        .from("student_marks")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      const nextMarks = [...marks, data as DraftMark];
      setMarks(nextMarks);
      await syncMainGradeCard(nextMarks);
      await runSync();
      await load();
      setDraft({
        subject: "",
        subject_code: "",
        course_category: "CORE COURSE",
        credits: 4,
        credits_earned: 4,
        marks_obtained: 0,
        max_marks: 100,
        grade: "",
        grade_points: 0,
      });
      toast.success("Manual mark added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add mark");
    }
  }

  const totalCredits = useMemo(
    () => marks.reduce((sum, row) => sum + Number(row.credits ?? 0), 0),
    [marks],
  );

  const totalCreditsEarned = useMemo(
    () => marks.reduce((sum, row) => sum + Number(row.credits_earned ?? 0), 0),
    [marks],
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading marks…</p>;
  if (!student || !header) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const shellClass = prettyCard
    ? compact
      ? "space-y-5"
      : "space-y-5 rounded-2xl border-2 border-primary/15 bg-white p-5 shadow-sm"
    : compact
      ? "space-y-4 rounded-xl border border-border bg-white/80 p-4"
      : "card-elevated rounded-2xl p-6";

  return (
    <div className={shellClass}>
      {prettyCard ? (
        <div className="mb-2 rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-white to-cream/80 p-5 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Edit marksheet header — click fields below
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-primary">
              <input
                value={header.programme_title}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, programme_title: e.target.value } : h))
                }
                className={`min-w-[12rem] flex-1 ${PRETTY_PROGRAMME}`}
                title="Programme title"
              />
              <span className="text-muted-foreground">·</span>
              <input
                value={header.programme_code}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, programme_code: e.target.value } : h))
                }
                className={`w-28 uppercase ${PRETTY_PROGRAMME}`}
                title="Programme code"
              />
            </div>
            <div className="rounded-xl border border-border bg-secondary/25 px-4 py-3 text-sm">
              <p>
                Courses: <strong>{marks.length}</strong>
              </p>
              <p>
                Credits: <strong>{totalCreditsEarned.toFixed(1)}</strong> / {totalCredits.toFixed(1)}
              </p>
              <p>
                SGPA: <strong>{header.semester_gpa}</strong> · Grade{" "}
                <strong>{header.final_grade || "—"}</strong>
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <PrettyField label="Name on card">
              <input
                value={header.card_student_name}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, card_student_name: e.target.value } : h))
                }
                className={PRETTY_FIELD}
              />
            </PrettyField>
            <PrettyField label="Roll no (portal ID)">
              <input
                readOnly
                value={student.student_id}
                title="Roll matches portal student id"
                className={PRETTY_ROLL_READONLY}
              />
            </PrettyField>
            <PrettyField label="Registration">
              <input
                value={header.registration_no}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, registration_no: e.target.value } : h))
                }
                className={PRETTY_FIELD}
              />
            </PrettyField>
            <PrettyField label="Semester">
              <input
                value={header.semester_label}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, semester_label: e.target.value } : h))
                }
                className={PRETTY_FIELD}
              />
            </PrettyField>
            <PrettyField label="Exam">
              <input
                value={header.exam_month_year}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, exam_month_year: e.target.value } : h))
                }
                className={PRETTY_FIELD}
              />
            </PrettyField>
            <PrettyField label="Grade card no">
              <input
                value={header.grade_card_no}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, grade_card_no: e.target.value } : h))
                }
                className={PRETTY_FIELD}
              />
            </PrettyField>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveGradeCardHeader()}
              disabled={headerBusy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${headerBusy ? "animate-spin" : ""}`} />
              {headerBusy ? "Saving…" : "Save header & sync"}
            </button>
            <span className="text-xs text-muted-foreground">
              Saves header + refreshes SGPA and PDF marksheet from subject rows.
            </span>
          </div>
        </div>
      ) : null}

      {!prettyCard ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-primary">
              {compact ? "Edit header & subjects" : "Subject marks (full marksheet data)"}
            </h3>
            {!compact ? (
              <p className="text-sm text-muted-foreground">
                Same fields as the Excel template (24btre152-style). Add every subject row here or use
                bulk upload on the Super Admin home page.
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
            Total credits: <strong>{totalCredits.toFixed(1)}</strong>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-primary">Course table — edit cells, then Save</h3>
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
            Total credits: <strong>{totalCredits.toFixed(1)}</strong>
          </div>
        </div>
      )}

      {prettyCard ? (
        <details className="mt-4 rounded-xl border border-border bg-cream/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            More fields: university, school, issue date, QR
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              University
              <input
                value={header.university}
                onChange={(e) => setHeader((h) => (h ? { ...h, university: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              School name
              <input
                value={header.school_name}
                onChange={(e) => setHeader((h) => (h ? { ...h, school_name: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Issue date
              <input
                value={header.issue_date}
                onChange={(e) => setHeader((h) => (h ? { ...h, issue_date: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
              QR / verification text
              <input
                value={header.qr_data}
                onChange={(e) => setHeader((h) => (h ? { ...h, qr_data: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </details>
      ) : (
        <div
          className={compact ? "mt-4 space-y-3" : "mt-4 rounded-xl border border-border bg-cream p-4"}
        >
          <h4 className="text-sm font-semibold text-primary">Card header</h4>
          {!compact ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Computed SGPA / final grade update from subject rows when you save.
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-medium text-muted-foreground">
              University
              <input
                value={header.university}
                onChange={(e) => setHeader((h) => (h ? { ...h, university: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              School name
              <input
                value={header.school_name}
                onChange={(e) => setHeader((h) => (h ? { ...h, school_name: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Grade card no.
              <input
                value={header.grade_card_no}
                onChange={(e) => setHeader((h) => (h ? { ...h, grade_card_no: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Programme title
              <input
                value={header.programme_title}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, programme_title: e.target.value } : h))
                }
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Programme code
              <input
                value={header.programme_code}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, programme_code: e.target.value } : h))
                }
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Registration no.
              <input
                value={header.registration_no}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, registration_no: e.target.value } : h))
                }
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Semester label
              <input
                value={header.semester_label}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, semester_label: e.target.value } : h))
                }
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Exam month &amp; year
              <input
                value={header.exam_month_year}
                onChange={(e) =>
                  setHeader((h) => (h ? { ...h, exam_month_year: e.target.value } : h))
                }
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Issue date
              <input
                value={header.issue_date}
                onChange={(e) => setHeader((h) => (h ? { ...h, issue_date: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-3">
              QR / verification text (optional)
              <input
                value={header.qr_data}
                onChange={(e) => setHeader((h) => (h ? { ...h, qr_data: e.target.value } : h))}
                className="mt-1 w-full rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              SGPA (after sync): <strong className="text-primary">{header.semester_gpa}</strong> · Grade{" "}
              <strong className="text-primary">{header.final_grade || "—"}</strong>
            </span>
            <button
              type="button"
              onClick={() => void saveGradeCardHeader()}
              disabled={headerBusy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${headerBusy ? "animate-spin" : ""}`} />
              {headerBusy ? "Saving…" : compact ? "Save header & sync" : "Save header & sync SGPA"}
            </button>
          </div>
        </div>
      )}

      <div
        className={`overflow-x-auto ${compact ? "mt-4" : "mt-4"} ${prettyCard ? "rounded-xl border border-primary/20 bg-white/90 p-3 shadow-inner" : ""}`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {prettyCard ? (
                <>
                  <th className="px-2 py-2">Sl</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Course</th>
                  <th className="px-2 py-2">Section</th>
                  <th className="px-2 py-2">Credits</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Points</th>
                  <th className="px-2 py-2">Obt</th>
                  <th className="px-2 py-2">Max</th>
                  <th className="px-2 py-2 w-32"></th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2">{compact ? "Sl" : "#"}</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">{compact ? "Course" : "Subject"}</th>
                  <th className="px-2 py-2">{compact ? "Section" : "Category"}</th>
                  <th className="px-2 py-2">Cr</th>
                  <th className="px-2 py-2">{compact ? "Earned" : "Cr earned"}</th>
                  <th className="px-2 py-2">Obt</th>
                  <th className="px-2 py-2">Max</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Pts</th>
                  <th className="px-2 py-2"></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {marks.map((row, index) => {
              const editing = draft.id === row.id;
              const current = editing ? { ...row, ...draft } : row;
              return (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.subject_code ?? "")}
                      onChange={(e) =>
                        setDraft((value) => ({
                          ...value,
                          id: row.id,
                          subject_code: e.target.value,
                        }))
                      }
                      className={
                        prettyCard
                          ? `${PRETTY_TABLE_INPUT} w-24`
                          : "w-28 rounded border border-border bg-cream px-2 py-1"
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.subject ?? "")}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, id: row.id, subject: e.target.value }))
                      }
                      className={
                        prettyCard
                          ? `${PRETTY_TABLE_INPUT} min-w-[11rem]`
                          : "min-w-[12rem] rounded border border-border bg-cream px-2 py-1"
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.course_category ?? "CORE COURSE")}
                      onChange={(e) =>
                        setDraft((value) => ({
                          ...value,
                          id: row.id,
                          course_category: e.target.value,
                        }))
                      }
                      className={
                        prettyCard
                          ? `${PRETTY_TABLE_INPUT} min-w-[9rem]`
                          : "w-40 rounded border border-border bg-cream px-2 py-1"
                      }
                    />
                  </td>
                  {prettyCard ? (
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-start gap-1 whitespace-nowrap">
                        <input
                          type="number"
                          title="Credits earned"
                          value={String(current.credits_earned ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              credits_earned: Number(e.target.value),
                            }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-11`}
                        />
                        <span className="text-muted-foreground">/</span>
                        <input
                          type="number"
                          title="Course credits"
                          value={String(current.credits ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              credits: Number(e.target.value),
                            }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-11`}
                        />
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.credits ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              credits: Number(e.target.value),
                            }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.credits_earned ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              credits_earned: Number(e.target.value),
                            }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                    </>
                  )}
                  {prettyCard ? (
                    <>
                      <td className="px-2 py-2">
                        <input
                          value={String(current.grade ?? "")}
                          onChange={(e) =>
                            setDraft((value) => ({ ...value, id: row.id, grade: e.target.value }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-12`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.grade_points ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              grade_points: Number(e.target.value),
                            }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-12`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.marks_obtained ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              marks_obtained: Number(e.target.value),
                            }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-14`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.max_marks ?? 100)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              max_marks: Number(e.target.value),
                            }))
                          }
                          className={`${PRETTY_TABLE_INPUT} w-14`}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.marks_obtained ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              marks_obtained: Number(e.target.value),
                            }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.max_marks ?? 100)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              max_marks: Number(e.target.value),
                            }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={String(current.grade ?? "")}
                          onChange={(e) =>
                            setDraft((value) => ({ ...value, id: row.id, grade: e.target.value }))
                          }
                          className="w-14 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={String(current.grade_points ?? 0)}
                          onChange={(e) =>
                            setDraft((value) => ({
                              ...value,
                              id: row.id,
                              grade_points: Number(e.target.value),
                            }))
                          }
                          className="w-14 rounded border border-border bg-cream px-2 py-1"
                        />
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void saveRow({ ...current, id: row.id })}
                        disabled={savingId === row.id}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRow(row.id!)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`rounded-xl border border-border bg-cream p-4 ${compact ? "mt-4" : "mt-6"}`}>
        <h4 className="text-sm font-semibold text-primary">Add subject</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={draft.subject_code ?? ""}
            onChange={(e) => setDraft((value) => ({ ...value, subject_code: e.target.value }))}
            placeholder="Course code"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            value={draft.subject ?? ""}
            onChange={(e) => setDraft((value) => ({ ...value, subject: e.target.value }))}
            placeholder="Course title"
            className="rounded border border-border bg-white px-3 py-2 md:col-span-2"
          />
          <input
            value={draft.course_category ?? "CORE COURSE"}
            onChange={(e) => setDraft((value) => ({ ...value, course_category: e.target.value }))}
            placeholder="Category (e.g. PRACTICAL)"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            type="number"
            value={String(draft.credits ?? 4)}
            onChange={(e) => setDraft((value) => ({ ...value, credits: Number(e.target.value) }))}
            placeholder="Credits"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            type="number"
            value={String(draft.credits_earned ?? 4)}
            onChange={(e) =>
              setDraft((value) => ({ ...value, credits_earned: Number(e.target.value) }))
            }
            placeholder="Credits earned"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            type="number"
            value={String(draft.marks_obtained ?? 0)}
            onChange={(e) =>
              setDraft((value) => ({ ...value, marks_obtained: Number(e.target.value) }))
            }
            placeholder="Marks obtained"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            type="number"
            value={String(draft.max_marks ?? 100)}
            onChange={(e) =>
              setDraft((value) => ({ ...value, max_marks: Number(e.target.value) }))
            }
            placeholder="Max marks"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            value={String(draft.grade ?? "")}
            onChange={(e) => setDraft((value) => ({ ...value, grade: e.target.value }))}
            placeholder="Grade (e.g. A+)"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            type="number"
            value={String(draft.grade_points ?? 0)}
            onChange={(e) =>
              setDraft((value) => ({ ...value, grade_points: Number(e.target.value) }))
            }
            placeholder="Grade points (optional)"
            className="rounded border border-border bg-white px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={() => void addManual()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add subject row
        </button>
      </div>
    </div>
  );
}

function PrettyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
