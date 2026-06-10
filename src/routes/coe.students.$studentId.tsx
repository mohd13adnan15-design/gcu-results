import { useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CoeStudentHub } from "@/features/coe/CoeStudentHub";

export function CoeStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  return (
    <AdminLayout
      requirePortal={["head_of_coe"]}
      title="Student record"
      subtitle="View and edit everything for this student in one place"
    >
      {() => (
        <div className="mx-auto max-w-6xl">
          <CoeStudentHub studentId={studentId} />
        </div>
      )}
    </AdminLayout>
  );
}
