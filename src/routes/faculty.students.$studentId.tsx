import { useParams } from "react-router-dom";

import { StudentMarksReviewPanel } from "@/features/marks/StudentMarksReviewPanel";

export function FacultyStudentMarksPage() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  return <StudentMarksReviewPanel studentId={studentId} portal="admin_2" />;
}
