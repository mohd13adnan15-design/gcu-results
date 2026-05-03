import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";

type PortalMode = "faculty" | "admin";

type Props = {
  studentId: string;
  portal: PortalMode;
};

export function StudentMarksReviewPanel({ studentId, portal }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [marks, setMarks] = useState<StudentMarkRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: studentData }, { data: markData }] = await Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase
        .from("student_marks")
        .select("subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true }),
    ]);
    setStudent((studentData as Student | null) ?? null);
    setMarks((markData as StudentMarkRow[]) ?? []);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`${portal}:student-marks:${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_marks", filter: `student_id=eq.${studentId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [portal, studentId]);

  const totals = useMemo(() => {
    const totalCredits = marks.reduce((sum, row) => sum + Number(row.credits ?? 0), 0);
    const totalMarks = marks.reduce((sum, row) => sum + Number(row.marks_obtained ?? 0), 0);
    const maxMarks = marks.reduce((sum, row) => sum + Number(row.max_marks ?? 0), 0);
    return { totalCredits, totalMarks, maxMarks };
  }, [marks]);

  async function requestRevaluation() {
    if (!student) return;
    setBusy(true);
    try {
      const message = note.trim()
        ? note.trim()
        : `Please review the marks for ${student.full_name} (${student.student_id}).`;
      const { error } = await supabase.from("portal_notifications").insert({
        recipient_portal: "super_admin",
        sender_portal: portal,
        student_id: student.id,
        title: "Revaluation requested",
        message,
      });
      if (error) throw error;
      toast.success("Revaluation request sent to Super Admin");
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Loading student marks…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to={portal === "faculty" ? "/faculty" : "/admin"}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="card-elevated rounded-2xl p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary">{student.full_name}</h2>
            <p className="text-sm text-muted-foreground">{student.student_id}</p>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm">
            <p>Total subjects: <strong>{marks.length}</strong></p>
            <p>Total credits: <strong>{totals.totalCredits.toFixed(1)}</strong></p>
            <p>Total marks: <strong>{totals.totalMarks}</strong> / {totals.maxMarks}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
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
              </tr>
            </thead>
            <tbody>
              {marks.map((row, index) => (
                <tr key={`${row.subject_code}-${index}`} className="border-b border-border/60">
                  <td className="px-2 py-2">{row.subject_code}</td>
                  <td className="px-2 py-2">{row.subject}</td>
                  <td className="px-2 py-2">{row.course_category ?? "CORE COURSE"}</td>
                  <td className="px-2 py-2">{row.credits}</td>
                  <td className="px-2 py-2">
                    {row.marks_obtained} / {row.max_marks}
                  </td>
                  <td className="px-2 py-2">{row.grade}</td>
                  <td className="px-2 py-2">{row.grade_points ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-cream p-4">
          <label className="block text-sm font-medium text-primary">
            Revaluation note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the unmatched or disputed marks"
              className="mt-2 min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <button
            onClick={requestRevaluation}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <MessageSquareWarning className="h-4 w-4" />
            {busy ? "Sending…" : "Request revaluation"}
          </button>
        </div>
      </div>
    </div>
  );
}