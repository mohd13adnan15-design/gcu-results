import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClearanceAdminPage } from "@/features/admin/ClearanceAdminPage";

export function FeesPortalPage() {
  return (
    <AdminLayout
      requirePortal={["fees", "head_of_coe"]}
      title="Academic Fees Portal"
      tagline="CLEARING THE PATH. YOUR EFFICIENCY TRANSFORMS FINANCIAL MILESTONES INTO ACADEMIC VICTORIES."
      subtitle="Academic fees & clearance"
    >
      {(session) => (
        <div className="space-y-6">
          {session.portal === "head_of_coe" ? (
            <Link
              to="/coe"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to COE
            </Link>
          ) : null}
          <ClearanceAdminPage kind="fees" />
        </div>
      )}
    </AdminLayout>
  );
}
