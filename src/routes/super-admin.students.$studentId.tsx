import { useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { SuperAdminStudentHub } from "@/features/admin/SuperAdminStudentHub";

export function SuperAdminStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  return (
    <AdminLayout
      requirePortal={["admin_1", "head_of_coe"]}
      title="Student record"
      subtitle="View and edit everything for this student in one place"
    >
      {() => (
        <div className="mx-auto max-w-6xl">
          <SuperAdminStudentHub studentId={studentId} />
        </div>
      )}
    </AdminLayout>
  );
}
