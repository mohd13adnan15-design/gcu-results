import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GradeCardApplicationForm } from "@/features/marks/GradeCardDetailsAdminPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export function GradeCardApplicationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get("studentId") ?? undefined;
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
      requirePortal={["admin_1", "head_of_coe"]}
      title="Grade card application"
      subtitle="Garden City University · Grade Card Portal"
    >
      {() => (
        <div className="mx-auto max-w-5xl space-y-6 pb-16">
          <Link
            to="/coe"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to COE
          </Link>
          <div className="card-elevated rounded-2xl p-6 shadow-sm md:p-10">
            <GradeCardApplicationForm
              initialStudentId={studentId ?? null}
              students={students}
              onCancel={() => navigate("/coe")}
              onSaved={() => navigate("/coe")}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
