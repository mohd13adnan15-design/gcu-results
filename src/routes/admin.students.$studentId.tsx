import { useParams } from "react-router-dom";

import { StudentMarksReviewPanel } from "@/features/marks/StudentMarksReviewPanel";

export function AdminStudentMarksPage() {
  const { studentId } = useParams<{ studentId: string }>();
  if (!studentId) return null;
  return <StudentMarksReviewPanel studentId={studentId} portal="admin_2" />;
}
