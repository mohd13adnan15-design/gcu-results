import { createFileRoute } from "@tanstack/react-router";

import { StudentMarksReviewPanel } from "@/components/StudentMarksReviewPanel";

export const Route = createFileRoute("/admin/students/$studentId")({
  head: () => ({ meta: [{ title: "Student marks — Admin" }] }),
  component: AdminStudentMarksPage,
});

function AdminStudentMarksPage() {
  const { studentId } = Route.useParams();
  return <StudentMarksReviewPanel studentId={studentId} portal="admin" />;
}
