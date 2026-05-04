import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { SuperAdminStudentHub } from "@/components/SuperAdminStudentHub";

export const Route = createFileRoute("/super-admin/students/$studentId")({
  head: () => ({ meta: [{ title: "Student record — Super Admin" }] }),
  component: SuperAdminStudentDetailPage,
});

function SuperAdminStudentDetailPage() {
  const { studentId } = Route.useParams();
  return (
    <AdminLayout
      requirePortal="super_admin"
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
