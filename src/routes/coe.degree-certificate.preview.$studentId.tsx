import { Link, useParams } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { DegreeCertificatePreviewPanel } from "@/features/degree-certificate/DegreeCertificatePreviewPanel";

export function CoeDegreeCertificatePreviewPage() {
  const { studentId } = useParams<{ studentId: string }>();

  return (
    <AdminLayout
      requirePortal={["head_of_coe"]}
      title="Degree Certificate Preview"
      tagline="Internal certificate preview for the selected student."
    >
      {() => (
        <div className="mx-auto max-w-5xl space-y-4">
          <Link
            to="/coe/degree-certificate"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            ← Back to all students
          </Link>
          {studentId ? (
            <DegreeCertificatePreviewPanel studentId={studentId} />
          ) : (
            <p className="text-sm text-muted-foreground">Student not specified.</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
