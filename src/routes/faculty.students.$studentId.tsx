import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { StudentMarksReviewPanel } from "@/components/StudentMarksReviewPanel";

export const Route = createFileRoute("/faculty/students/$studentId")({
  head: () => ({ meta: [{ title: "Student marks — Faculty" }] }),
  component: FacultyStudentMarksPage,
});

function FacultyStudentMarksPage() {
  const { studentId } = Route.useParams();

  return (
    <AdminLayout
      requirePortal="faculty"
      title="Faculty Portal"
      subtitle="Review student marks"
    >
      {() => <StudentMarksReviewPanel studentId={studentId} portal="faculty" />}
    </AdminLayout>
  );
}