import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Student, StudentMarkRow } from "@/lib/types";
import { toast } from "sonner";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — GCU" }] }),
  component: () => (
    <AdminLayout requirePortal="admin" title="Admin Portal" subtitle="Full verification dashboard">
      {() => <AdminPage />}
    </AdminLayout>
  ),
});

function AdminPage() {
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
      .channel("admin:students")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_marks" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function markFullyVerified(student: Student, next: boolean) {
    const { error } = await supabase
      .from("students")
      .update({
        admin_verified: next,
        fully_verified: next,
      })
      .eq("id", student.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Marked as fully verified" : "Admin verification removed");
    setStudents((prev) =>
      prev.map((value) =>
        value.id === student.id ? { ...value, admin_verified: next, fully_verified: next } : value,
      ),
    );
  }

  async function requestRecheck(student: Student) {
    const { error } = await supabase.from("portal_notifications").insert({
      recipient_portal: "super_admin",
      sender_portal: "admin",
      student_id: student.id,
      title: "Recheck requested",
      message: `Please recheck and update data for ${student.student_id}.`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("students")
      .update({ admin_verified: false, fully_verified: false })
      .eq("id", student.id);
    toast.success("Recheck request sent to Super Admin");
    load();
  }

  const rows = useMemo(
    () =>
      students.map((student) => {
        const studentMarks = marks.filter((row) => row.student_id === student.id);
        const subjects = studentMarks.slice(0, 3).map((row) => row.subject_code || row.subject).join(", ");
        const noDue =
          student.fees_cleared &&
          (!student.in_hostel || student.hostel_cleared) &&
          (!student.in_library || student.library_cleared);
        const locked = !(
          noDue &&
          Boolean(student.faculty_verified) &&
          Boolean(student.admin_verified)
        );
        return { student, noDue, locked, studentMarks, subjects };
      }),
    [students, marks],
  );

  return (
    <div className="card-elevated rounded-2xl p-6">
      <h2 className="text-xl font-bold text-primary">Unified student verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review uploaded marks from <strong>student_marks</strong>, then open the full student view to request revaluation.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Subjects</th>
              <th className="px-2 py-2">Mark Count</th>
              <th className="px-2 py-2">Faculty Verified</th>
              <th className="px-2 py-2">Admin Verified</th>
              <th className="px-2 py-2">Locked / Unlocked</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, noDue, locked, studentMarks, subjects }) => {
              const allReady = noDue && Boolean(student.faculty_verified);
              return (
                <tr key={student.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <p className="font-medium text-primary">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{student.student_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Fees: {student.fees_cleared ? "Clear" : "Pending"} · Hostel:{" "}
                      {!student.in_hostel || student.hostel_cleared ? "Clear" : "Pending"} ·
                      Library:{" "}
                      {!student.in_library || student.library_cleared ? "Clear" : "Pending"}
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs text-primary">
                      {subjects || "No marks uploaded"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-primary">{studentMarks.length}</td>
                  <td className="px-2 py-2">{student.faculty_verified ? "Yes" : "No"}</td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(student.admin_verified)}
                      disabled={!allReady}
                      onChange={(e) => markFullyVerified(student, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-2">{locked ? "Locked" : "Unlocked"}</td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => requestRecheck(student)}
                        className="rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                      >
                        Request Recheck
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
