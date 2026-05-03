import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { GradeCardApplicationForm } from "@/components/GradeCardDetailsAdminPanel";
import { StudentMarksAdminEditor } from "@/components/StudentMarksAdminEditor";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

type Search = { studentId: string };

export const Route = createFileRoute("/super-admin/students/$studentId")({
  head: () => ({ meta: [{ title: "Student marks — Super Admin" }] }),
  component: SuperAdminStudentDetailPage,
});

function SuperAdminStudentDetailPage() {
  const { studentId } = Route.useParams();
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    void supabase
      .from("students")
      .select("*")
      .order("student_id", { ascending: true })
      .then(({ data }) => setStudents((data as Student[]) ?? []));
  }, []);

  return (
    <AdminLayout
      requirePortal="super_admin"
      title="Student marks"
      subtitle="Main grade card editor"
    >
      {() => (
        <div className="mx-auto max-w-6xl space-y-6">
          <Link
            to="/super-admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Super Admin
          </Link>

          <div className="card-elevated rounded-2xl p-6">
            <h2 className="text-lg font-bold text-primary">Header details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit the student's grade-card header details and keep them in sync with Main Grade Card.
            </p>
            <div className="mt-4">
              <GradeCardApplicationForm
                initialStudentId={studentId}
                students={students}
                onCancel={() => {
                  window.history.back();
                }}
                onSaved={() => {
                  window.location.reload();
                }}
              />
            </div>
          </div>

          <StudentMarksAdminEditor studentId={studentId} />
        </div>
      )}
    </AdminLayout>
  );
}