import { Link } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { DegreeCertificateStudentList } from "@/features/degree-certificate/DegreeCertificateStudentList";

export function CoeDegreeCertificatePage() {
  return (
    <AdminLayout
      requirePortal={["head_of_coe"]}
      title="Degree Certificate"
      tagline="Internal preview of convocation degree certificates from COE academic records."
    >
      {() => <CoeDegreeCertificateContent />}
    </AdminLayout>
  );
}

function CoeDegreeCertificateContent() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-border bg-cream p-4">
        <p className="text-sm text-muted-foreground">
          All students with COE-uploaded marksheet data. Use <strong>Preview</strong> to open each
          student&apos;s degree certificate on a separate page. CGPA is calculated from semester
          SGPAs.
        </p>
        <Link
          to="/coe"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Back to COE dashboard
        </Link>
      </div>

      <DegreeCertificateStudentList />
    </div>
  );
}
