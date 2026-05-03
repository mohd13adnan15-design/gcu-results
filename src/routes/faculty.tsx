import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/faculty")({
  head: () => ({ meta: [{ title: "Faculty Portal — GCU" }] }),
  component: () => (
    <AdminLayout requirePortal="faculty" title="Faculty Portal" subtitle="Review and verify marks">
      {() => <FacultyPage />}
    </AdminLayout>
  ),
});

function FacultyPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Array<StudentMarkRow & { student_id: string }>>([]);

  async function load() {
    const [{ data: studentRows }, { data: markRows }] = await Promise.all([
      supabase.from("students").select("*").order("student_id", { ascending: true }),
      supabase
        .from("student_marks")
        .select("student_id,subject,subject_code,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points")
        .order("created_at", { ascending: true }),
    ]);
    setStudents((studentRows as Student[]) ?? []);
    setMarks((markRows as Array<StudentMarkRow & { student_id: string }>) ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("faculty:students")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function toggleFacultyVerified(student: Student) {
    const next = !student.faculty_verified;
    const { error } = await supabase
      .from("students")
      .update({
        faculty_verified: next,
        admin_verified: next ? student.admin_verified : false,
        fully_verified: next ? student.fully_verified : false,
      })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (next) {
      await supabase.from("portal_notifications").insert({
        recipient_portal: "admin",
        sender_portal: "faculty",
        student_id: student.id,
        title: "Faculty verification complete",
        message: `${student.student_id} was verified by Faculty and is ready for Admin review.`,
      });
    }
    toast.success(next ? "Faculty verified" : "Faculty verification removed");
    setStudents((prev) =>
      prev.map((value) =>
        value.id === student.id
          ? {
              ...value,
              faculty_verified: next,
              admin_verified: next ? value.admin_verified : false,
            }
          : value,
      ),
    );
  }

  const rows = useMemo(
    () =>
      students.map((student) => {
        const studentMarks = marks.filter((row) => row.student_id === student.id);
        const subjects = studentMarks.slice(0, 2).map((row) => row.subject_code || row.subject).join(", ");
        return { student, studentMarks, subjects };
      }),
    [students, marks],
  );

  return (
    <div className="card-elevated rounded-2xl p-6">
      <h2 className="text-xl font-bold text-primary">Marks verification queue</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review uploaded marks from <strong>student_marks</strong> and open the full student view.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Subjects</th>
              <th className="px-2 py-2">Mark Count</th>
              <th className="px-2 py-2">Faculty Verified</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, studentMarks, subjects }) => (
              <tr key={student.id} className="border-b border-border/60">
                <td className="px-2 py-2">
                  <p className="font-medium text-primary">{student.full_name}</p>
                  <p className="text-xs text-muted-foreground">{student.student_id}</p>
                </td>
                <td className="px-2 py-2">
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs text-primary">
                    {subjects || "No marks uploaded"}
                  </span>
                </td>
                <td className="px-2 py-2 text-primary">{studentMarks.length}</td>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(student.faculty_verified)}
                    onChange={() => toggleFacultyVerified(student)}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <Link
                    to="/faculty/students/$studentId"
                    params={{ studentId: student.id }}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-xs text-primary hover:bg-secondary"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
