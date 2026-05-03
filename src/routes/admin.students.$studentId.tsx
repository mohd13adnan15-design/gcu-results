import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { StudentMarksReviewPanel } from "@/components/StudentMarksReviewPanel";

export const Route = createFileRoute("/admin/students/$studentId")({
  head: () => ({ meta: [{ title: "Student marks — Admin" }] }),
  component: AdminStudentMarksPage,
});

function AdminStudentMarksPage() {
  const { studentId } = Route.useParams();

  return (
    <AdminLayout requirePortal="admin" title="Admin Portal" subtitle="Review student marks">
      {() => <StudentMarksReviewPanel studentId={studentId} portal="admin" />}
    </AdminLayout>
  );
}