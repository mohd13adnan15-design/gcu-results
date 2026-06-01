import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClearanceAdminPage } from "@/features/admin/ClearanceAdminPage";

export function HostelPortalPage() {
  return (
    <AdminLayout 
      requirePortal={["hostel", "head_of_coe", "admin_1"]}
      title="Hostel Portal" 
      tagline="THE FINAL CLEARANCE. PROVIDING THE STABILITY NEEDED TO TRANSITION FROM CAMPUS TO CAREER."
      subtitle="Hostel fees & clearance"
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
          <ClearanceAdminPage kind="hostel" />
        </div>
      )}
    </AdminLayout>
  );
}
