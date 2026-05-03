import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildMainGradeCardRows } from "@/lib/main-grade-card";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

type DraftMark = StudentMarkRow & { id?: string };

type Props = {
  studentId: string;
};

export function StudentMarksAdminEditor({ studentId }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [header, setHeader] = useState<{
    programme_title: string;
    programme_code: string;
    registration_no: string;
    exam_month_year: string;
    issue_date: string;
    semester_label: string;
    semester_gpa: number;
    final_grade: string;
  } | null>(null);
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

  async function load() {
    setLoading(true);
    const [{ data: studentData }, { data: headerData }, { data: marksData }] = await Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase.from("grade_card_details").select("*").eq("student_id", studentId).maybeSingle(),
      supabase
        .from("student_marks")
        .select("id,subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true }),
    ]);

    const currentStudent = (studentData as Student | null) ?? null;
    setStudent(currentStudent);
    setHeader({
      programme_title: (headerData as any)?.programme_title ?? "Bachelor of Computer Applications",
      programme_code: (headerData as any)?.programme_code ?? "BCAR",
      registration_no: (headerData as any)?.registration_no ?? currentStudent?.student_id ?? "",
      exam_month_year: (headerData as any)?.exam_month_year ?? "",
      issue_date: (headerData as any)?.issue_date ?? "",
      semester_label: (headerData as any)?.semester_label ?? `Semester ${currentStudent?.semester ?? ""}`,
      semester_gpa: Number((headerData as any)?.semester_gpa ?? 0),
      final_grade: (headerData as any)?.final_grade ?? "",
    });
    setMarks(((marksData as DraftMark[]) ?? []).filter(Boolean));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [studentId]);

  async function syncMainGradeCard(nextMarks: DraftMark[]) {
    if (!student) return;
    const rowHeader = header ?? {
      programme_title: "Bachelor of Computer Applications",
      programme_code: "BCAR",
      registration_no: student.student_id,
      exam_month_year: "",
      issue_date: "",
      semester_label: `Semester ${student.semester}`,
      semester_gpa: 0,
      final_grade: "",
    };
    const rows = buildMainGradeCardRows(
      student,
      {
        ...rowHeader,
        student_name: student.full_name,
      },
      nextMarks,
    );
    const { error: deleteError } = await supabase.from("main_grade_card").delete().eq("student_id", student.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from("main_grade_card").insert(rows);
    if (insertError) throw insertError;
  }

  function beginEdit(row: DraftMark) {
    setDraft({ ...row });
  }

  async function saveRow(row: DraftMark) {
    if (!row.id) return;
    const marksObtained = Number(row.marks_obtained ?? 0);
    const maxMarks = Number(row.max_marks ?? 100);
    const grade = String(row.grade ?? "").trim().toUpperCase();
    const credits = Number(row.credits ?? 0);
    const creditsEarned = Number(row.credits_earned ?? 0) || (grade === "RA" ? 0 : credits);
    const gradePoints = Number(row.grade_points ?? 0);
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
      const grade = String(draft.grade ?? "").trim().toUpperCase();
      const credits = Number(draft.credits ?? 0);
      const creditsEarned = Number(draft.credits_earned ?? 0) || (grade === "RA" ? 0 : credits);
      const payload = {
        student_id: student.id,
        subject: draft.subject,
        subject_code: draft.subject_code,
        course_category: draft.course_category ?? "CORE COURSE",
        credits,
        credits_earned: creditsEarned,
        marks_obtained: Number(draft.marks_obtained ?? 0),
        max_marks: Number(draft.max_marks ?? 100),
        grade: grade || "RA",
        grade_points: Number(draft.grade_points ?? 0),
      };
      const { data, error } = await supabase.from("student_marks").insert(payload).select().single();
      if (error) throw error;
      const nextMarks = [...marks, data as DraftMark];
      setMarks(nextMarks);
      await syncMainGradeCard(nextMarks);
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading marks…</p>;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-primary">Subject marks</h3>
          <p className="text-sm text-muted-foreground">
            Edit or add individual marks for {student?.full_name ?? studentId}.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
          Total credits: <strong>{totalCredits.toFixed(1)}</strong>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Subject</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Credits</th>
              <th className="px-2 py-2">Marks</th>
              <th className="px-2 py-2">Grade</th>
              <th className="px-2 py-2">Points</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {marks.map((row) => {
              const editing = draft.id === row.id;
              const current = editing ? { ...row, ...draft } : row;
              return (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <input
                      value={String(current.subject_code ?? "")}
                      onChange={(e) => setDraft((value) => ({ ...value, id: row.id, subject_code: e.target.value }))}
                      className="w-28 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.subject ?? "")}
                      onChange={(e) => setDraft((value) => ({ ...value, id: row.id, subject: e.target.value }))}
                      className="w-64 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.course_category ?? "CORE COURSE")}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, id: row.id, course_category: e.target.value }))
                      }
                      className="w-44 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={String(current.credits ?? 0)}
                      onChange={(e) => setDraft((value) => ({ ...value, id: row.id, credits: Number(e.target.value) }))}
                      className="w-20 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={String(current.marks_obtained ?? 0)}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, id: row.id, marks_obtained: Number(e.target.value) }))
                      }
                      className="w-24 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={String(current.grade ?? "")}
                      onChange={(e) => setDraft((value) => ({ ...value, id: row.id, grade: e.target.value }))}
                      className="w-20 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={String(current.grade_points ?? 0)}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, id: row.id, grade_points: Number(e.target.value) }))
                      }
                      className="w-20 rounded border border-border bg-cream px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => saveRow({ ...current, id: row.id })}
                        disabled={savingId === row.id}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => deleteRow(row.id!)}
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

      <div className="mt-6 rounded-xl border border-border bg-cream p-4">
        <h4 className="text-sm font-semibold text-primary">Add manual mark</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={draft.subject_code ?? ""}
            onChange={(e) => setDraft((value) => ({ ...value, subject_code: e.target.value }))}
            placeholder="Subject code"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            value={draft.subject ?? ""}
            onChange={(e) => setDraft((value) => ({ ...value, subject: e.target.value }))}
            placeholder="Subject title"
            className="rounded border border-border bg-white px-3 py-2 md:col-span-2"
          />
          <input
            value={draft.course_category ?? "CORE COURSE"}
            onChange={(e) => setDraft((value) => ({ ...value, course_category: e.target.value }))}
            placeholder="Course category"
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
            value={String(draft.marks_obtained ?? 0)}
            onChange={(e) => setDraft((value) => ({ ...value, marks_obtained: Number(e.target.value) }))}
            placeholder="Marks obtained"
            className="rounded border border-border bg-white px-3 py-2"
          />
          <input
            value={String(draft.grade ?? "")}
            onChange={(e) => setDraft((value) => ({ ...value, grade: e.target.value }))}
            placeholder="Grade"
            className="rounded border border-border bg-white px-3 py-2"
          />
        </div>
        <button
          onClick={addManual}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add mark
        </button>
      </div>
    </div>
  );
}