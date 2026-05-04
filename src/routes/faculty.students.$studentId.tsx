import { createFileRoute } from "@tanstack/react-router";

import { StudentMarksReviewPanel } from "@/components/StudentMarksReviewPanel";

export const Route = createFileRoute("/faculty/students/$studentId")({
  head: () => ({ meta: [{ title: "Student marks — Faculty" }] }),
  component: FacultyStudentMarksPage,
});

function FacultyStudentMarksPage() {
  const { studentId } = Route.useParams();
  return <StudentMarksReviewPanel studentId={studentId} portal="faculty" />;
}
