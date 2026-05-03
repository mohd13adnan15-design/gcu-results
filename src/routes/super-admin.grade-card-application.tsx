import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { GradeCardApplicationForm } from "@/components/GradeCardDetailsAdminPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

type GradeCardApplicationSearch = {
  studentId?: string;
};

export const Route = createFileRoute("/super-admin/grade-card-application")({
  validateSearch: (search: Record<string, unknown>): GradeCardApplicationSearch => ({
    studentId: typeof search.studentId === "string" ? search.studentId : undefined,
  }),
  head: () => ({ meta: [{ title: "Grade card application — Super Admin" }] }),
  component: GradeCardApplicationPage,
});

function GradeCardApplicationPage() {
  const navigate = useNavigate();
  const { studentId } = Route.useSearch();
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
      title="Grade card application"
      subtitle="Garden City University · Result Portal"
    >
      {() => (
        <div className="mx-auto max-w-5xl space-y-6 pb-16">
          <Link
            to="/super-admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Super Admin
          </Link>
          <div className="card-elevated rounded-2xl p-6 shadow-sm md:p-10">
            <GradeCardApplicationForm
              initialStudentId={studentId ?? null}
              students={students}
              onCancel={() => navigate({ to: "/super-admin" })}
              onSaved={() => navigate({ to: "/super-admin" })}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
